"""Minimal VOTable reader (IVOA 1.3), enough for TAP query results."""

from __future__ import annotations

import csv
import io
import xml.etree.ElementTree as ET

VOTABLE_NS = "{http://www.ivoa.net/xml/VOTable/v1.3}"


def parse_rows(text: str) -> tuple[list[str], list[list[str]]]:
    """Return (field names, rows) from a VOTable payload."""
    root = ET.fromstring(text)
    fields = [f.get("name", "") for f in root.iter(f"{VOTABLE_NS}FIELD")]
    rows = [
        [(td.text or "").strip() for td in tr.iter(f"{VOTABLE_NS}TD")]
        for tr in root.iter(f"{VOTABLE_NS}TR")
    ]
    return fields, rows


def parse_table(text: str) -> tuple[list[str], list[list[str]]]:
    """Parse a TAP result in whichever format the service returned."""
    if text.lstrip().startswith("<?xml") or "<VOTABLE" in text[:2048]:
        return parse_rows(text)
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return ([], [])
    return (rows[0], rows[1:])


def as_dicts(fields: list[str], rows: list[list[str]]) -> list[dict[str, str]]:
    return [dict(zip(fields, row)) for row in rows]


def to_float(value: str | None) -> float | None:
    """VOTable uses an empty cell for null; NaN means no measurement."""
    if value is None or value.strip() == "":
        return None
    return float(value)