"""Transactions enregistrées par l'analyste : création, lecture, modification, suppression, analyse."""

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

import audit
import history
from database import get_db
from db_models import Transaction, User
from model_service import DEFAULT_MODEL, FEATURES, MODEL_FILES, THRESHOLD, ModelNotLoadedError, service
from schemas import TransactionIn, TransactionUpdateIn
from security import ANALYST, require_roles
from timeutil import iso, utcnow

router = APIRouter(prefix="/transactions", tags=["Transactions"])
analyst_only = require_roles(ANALYST)


def serialize(tx: Transaction, with_features: bool = False) -> dict:
    data = {
        "id": tx.id,
        "reference": tx.reference,
        "description": tx.description,
        "amount": tx.amount,
        "time": tx.time,
        "true_label": tx.true_label,
        "source": tx.source,
        "dataset_row": tx.dataset_row,
        "last_model": tx.last_model,
        "last_probability": tx.last_probability,
        "last_risk_score": None if tx.last_probability is None else round(tx.last_probability * 100, 1),
        "last_is_fraud": tx.last_is_fraud,
        "last_analyzed_at": iso(tx.last_analyzed_at),
        "created_at": iso(tx.created_at),
        "updated_at": iso(tx.updated_at),
    }
    if with_features:
        data["features"] = tx.features
    return data


def _get_owned(db: Session, tx_id: int, user: User) -> Transaction:
    tx = db.get(Transaction, tx_id)
    # 404 aussi pour la transaction d'un autre analyste : on ne révèle pas qu'elle existe.
    if tx is None or tx.owner_id != user.id:
        raise HTTPException(404, "Transaction introuvable.")
    return tx


@router.get("")
def list_transactions(
    q: str = Query("", max_length=100),
    label: str = Query("all"),
    verdict: str = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    query = select(Transaction).where(Transaction.owner_id == user.id)
    if q.strip():
        pattern = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(func.coalesce(Transaction.reference, "")).like(pattern),
                func.lower(func.coalesce(Transaction.description, "")).like(pattern),
            )
        )
    label_filters = {
        "fraud": Transaction.true_label == 1,
        "normal": Transaction.true_label == 0,
        "unknown": Transaction.true_label.is_(None),
    }
    verdict_filters = {
        "fraud": Transaction.last_is_fraud.is_(True),
        "normal": Transaction.last_is_fraud.is_(False),
        "pending": Transaction.last_is_fraud.is_(None),
    }
    if label != "all":
        if label not in label_filters:
            raise HTTPException(422, f"Filtre de classe inconnu : {label}")
        query = query.where(label_filters[label])
    if verdict != "all":
        if verdict not in verdict_filters:
            raise HTTPException(422, f"Filtre de verdict inconnu : {verdict}")
        query = query.where(verdict_filters[verdict])

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"total": total, "page": page, "page_size": page_size, "rows": [serialize(t) for t in rows]}


@router.post("", status_code=201)
def create_transaction(
    data: TransactionIn,
    request: Request,
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    tx = Transaction(
        owner_id=user.id,
        reference=data.reference,
        description=data.description,
        features=data.features,
        amount=data.features["Amount"],
        time=data.features["Time"],
        true_label=data.true_label,
        source=data.source,
        dataset_row=data.dataset_row,
    )
    db.add(tx)
    db.commit()
    audit.log(db, "transaction.create", user=user, target=f"transaction:{tx.id}",
              details={"reference": tx.reference, "source": tx.source}, request=request)
    return serialize(tx, with_features=True)


@router.get("/{tx_id}")
def get_transaction(tx_id: int, user: User = Depends(analyst_only), db: Session = Depends(get_db)):
    return serialize(_get_owned(db, tx_id, user), with_features=True)


@router.put("/{tx_id}")
def update_transaction(
    tx_id: int,
    data: TransactionUpdateIn,
    request: Request,
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    tx = _get_owned(db, tx_id, user)
    fields = data.model_fields_set
    changed = []

    if data.features is not None and data.features != tx.features:
        tx.features = data.features
        tx.amount = data.features["Amount"]
        tx.time = data.features["Time"]
        # Les variables ont changé : l'ancien verdict ne s'applique plus.
        tx.last_model = tx.last_probability = tx.last_is_fraud = tx.last_analyzed_at = None
        changed.append("features")
    if "reference" in fields and data.reference != tx.reference:
        tx.reference = data.reference
        changed.append("reference")
    if "description" in fields and data.description != tx.description:
        tx.description = data.description
        changed.append("description")
    if data.clear_label:
        if tx.true_label is not None:
            changed.append("true_label")
        tx.true_label = None
    elif "true_label" in fields and data.true_label != tx.true_label:
        tx.true_label = data.true_label
        changed.append("true_label")

    tx.updated_at = utcnow()
    db.commit()
    audit.log(db, "transaction.update", user=user, target=f"transaction:{tx.id}",
              details={"changed": changed}, request=request)
    return serialize(tx, with_features=True)


@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: int,
    request: Request,
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    tx = _get_owned(db, tx_id, user)
    reference = tx.reference
    db.delete(tx)
    db.commit()
    audit.log(db, "transaction.delete", user=user, target=f"transaction:{tx_id}",
              details={"reference": reference}, request=request)
    return {"detail": "Transaction supprimée."}


@router.post("/{tx_id}/analyze")
def analyze_transaction(
    tx_id: int,
    request: Request,
    model: str = Query(DEFAULT_MODEL),
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    if model not in MODEL_FILES:
        raise HTTPException(422, f"Modèle inconnu : {model}")
    tx = _get_owned(db, tx_id, user)

    frame = pd.DataFrame([{f: tx.features[f] for f in FEATURES}])
    try:
        probability = float(service.predict_proba(frame, model)[0])
    except ModelNotLoadedError as exc:
        raise HTTPException(503, f"Modèle non chargé : {exc}") from exc

    is_fraud = probability >= THRESHOLD
    tx.last_model = model
    tx.last_probability = probability
    tx.last_is_fraud = is_fraud
    tx.last_analyzed_at = utcnow()
    db.commit()

    entry = history.record(
        db, user, "transaction", model=model, threshold=THRESHOLD,
        rows=[(tx.amount, probability, is_fraud, tx.true_label)],
        transaction_id=tx.id,
        summary={"reference": tx.reference},
    )
    audit.log(db, "transaction.analyze", user=user, target=f"transaction:{tx.id}",
              details={"model": model, "is_fraud": is_fraud, "analysis_id": entry.id}, request=request)

    return {
        "transaction": serialize(tx, with_features=True),
        "analysis_id": entry.id,
        "model": model,
        "probability": probability,
        "risk_score": round(probability * 100, 1),
        "is_fraud": is_fraud,
        "threshold": THRESHOLD,
        "risk_level": history.risk_level(probability),
    }
