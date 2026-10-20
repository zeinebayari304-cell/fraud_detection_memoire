"""Commandes d'administration.

Exemples (depuis le dossier backend) :
    python manage.py create-user --username admin1 --email <e-mail> --role admin
    python manage.py list-users
    python manage.py reset-password --username admin1

Le mot de passe est demandé au clavier (jamais écrit dans la commande).
"""

import argparse
import getpass
import sys

from sqlalchemy import func, select

from database import SessionLocal, init_db
from db_models import User
from schemas import check_email, check_password, check_username
from security import ROLES, hash_password


def _ask_password() -> str:
    while True:
        password = getpass.getpass("Mot de passe : ")
        confirm = getpass.getpass("Confirmez : ")
        if password != confirm:
            print("Les deux mots de passe ne correspondent pas.")
            continue
        try:
            return check_password(password)
        except ValueError as exc:
            print(exc)


def create_user(args) -> int:
    try:
        username = check_username(args.username)
        email = check_email(args.email)
    except ValueError as exc:
        print(f"Erreur : {exc}")
        return 1
    with SessionLocal() as db:
        taken = db.scalar(
            select(User.id).where(
                (func.lower(User.username) == username) | (func.lower(User.email) == email)
            )
        )
        if taken:
            print("Erreur : nom d'utilisateur ou e-mail déjà utilisé.")
            return 1
        user = User(
            username=username,
            email=email,
            full_name=args.full_name,
            role=args.role,
            password_hash=hash_password(_ask_password()),
        )
        db.add(user)
        db.commit()
        print(f"Utilisateur « {username} » créé avec le rôle {args.role}.")
    return 0


def list_users(_args) -> int:
    with SessionLocal() as db:
        for user in db.scalars(select(User).order_by(User.id)):
            state = "actif" if user.is_active else "désactivé"
            print(f"{user.id:>4}  {user.username:<20} {user.role:<9} {state:<10} {user.email}")
    return 0


def reset_password(args) -> int:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(func.lower(User.username) == args.username.lower()))
        if user is None:
            print("Erreur : utilisateur introuvable.")
            return 1
        user.password_hash = hash_password(_ask_password())
        user.token_version += 1
        user.failed_logins = 0
        user.locked_until = None
        db.commit()
        print(f"Mot de passe de « {user.username} » réinitialisé.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Administration de FraudShield")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-user", help="créer un utilisateur")
    create.add_argument("--username", required=True)
    create.add_argument("--email", required=True)
    create.add_argument("--role", choices=ROLES, default="admin")
    create.add_argument("--full-name", default=None)
    create.set_defaults(func=create_user)

    sub.add_parser("list-users", help="lister les utilisateurs").set_defaults(func=list_users)

    reset = sub.add_parser("reset-password", help="réinitialiser un mot de passe")
    reset.add_argument("--username", required=True)
    reset.set_defaults(func=reset_password)

    args = parser.parse_args()
    init_db(retries=1)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
