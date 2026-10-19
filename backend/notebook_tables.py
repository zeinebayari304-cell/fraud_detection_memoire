"""Lecture des tableaux de résultats exécutés dans les notebooks du mémoire.

Les notebooks (.ipynb) contiennent, dans leurs sorties, les DataFrames affichés
par `display(df)` au format HTML. On les relit tels quels : aucune valeur n'est
recopiée à la main, les pages de résultats reflètent donc exactement les
notebooks présents dans le dépôt.

Un tableau est identifié par ses colonnes (et non par un numéro de cellule),
ce qui reste valable si des cellules sont ajoutées ou déplacées.
"""

import json
import re
import unicodedata
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path

NOTEBOOKS_DIR = Path(__file__).resolve().parent.parent / "notebooks"
ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th"):
            self._cell = ""

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(self._cell.strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell += data


def _convert(value: str):
    if value in ("True", "False"):
        return value == "True"
    try:
        number = float(value)
    except ValueError:
        return value
    return int(number) if re.fullmatch(r"-?\d+", value) else number


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def canonical_model(name: str) -> str:
    """Harmonise les noms de modèles (accents, casse, variantes)."""
    key = _strip_accents(str(name)).lower().replace("_", " ").strip()
    if "random" in key or key == "rf":
        return "Random Forest"
    if "xgb" in key or "xgboost" in key:
        return "XGBoost"
    if "light" in key or "lgbm" in key:
        return "LightGBM"
    if "svm" in key:
        return "SVM linéaire"
    if "logist" in key:
        return "Régression logistique"
    return str(name)


@lru_cache(maxsize=32)
def _tables_of(path_str: str, mtime: float) -> tuple:
    notebook = json.loads(Path(path_str).read_text(encoding="utf-8"))
    tables = []
    for index, cell in enumerate(notebook.get("cells", [])):
        if cell.get("cell_type") != "code":
            continue
        for output in cell.get("outputs", []):
            html = output.get("data", {}).get("text/html")
            if not html:
                continue
            parser = _TableParser()
            parser.feed("".join(html))
            if len(parser.rows) < 2:
                continue
            header = parser.rows[0]
            records = []
            for row in parser.rows[1:]:
                if len(row) != len(header):
                    continue
                record = {}
                for column, value in zip(header, row):
                    record[column or "_index"] = _convert(value)
                records.append(record)
            if records:
                tables.append((index, tuple(header), tuple(records)))
    return tuple(tables)


def all_tables(notebook: str) -> list[tuple[int, list[str], list[dict]]]:
    path = NOTEBOOKS_DIR / f"{notebook}.ipynb"
    if not path.is_file():
        return []
    return [
        (cell, list(header), [dict(r) for r in records])
        for cell, header, records in _tables_of(str(path), path.stat().st_mtime)
    ]


def find_table(
    notebook: str,
    required: list[str],
    nth: int = 0,
    exact_rows: int | None = None,
) -> list[dict] | None:
    """Retourne le n-ième tableau du notebook contenant toutes les colonnes."""
    matches = [
        records
        for _, header, records in all_tables(notebook)
        if all(column in header for column in required)
        and (exact_rows is None or len(records) == exact_rows)
    ]
    return matches[nth] if len(matches) > nth else None


def read_json(*parts: str):
    path = ARTIFACTS_DIR.joinpath(*parts)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
