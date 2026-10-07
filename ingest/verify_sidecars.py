"""Do the shipped celestial-menu sidecars still resolve
to their sources?

Each menu dataset ships a sidecar beside its tile: the
rows a fact card needs that a tile cannot carry. This
proves those rows still resolve against the service the
tile cites -- the same contract `check_small_bodies`
holds for the small-body sidecar, extended to the
planets, satellites, galaxies and black holes.
"""

from __future__ import annotations

from ingest.sources import black_holes, galaxies, horizons


def check_horizons(payload: dict) -> dict:
    """Every body resolves against a fresh Horizons
    ephemeris; name, radius and photometry agree.

    The ephemeris for a past epoch is stable, so a
    disagreement is a real defect, not the archive
    moving.
    """
    kind = payload["dataset_kind"]
    fresh = {
        record.source_id: record
        for record in horizons.fetch(kind=kind)
    }
    problems: list[dict] = []
    for body in payload["bodies"]:
        code = str(body["code"])
        record = fresh.get(code)
        if record is None:
            problems.append({
                "id": code,
                "problem": "code no longer in the Horizons ephemeris",
                "asset": kind,
                "source": "nasa.jpl.horizons",
            })
            continue
        extra = record.extra
        for field in ("name", "radius_km", "v_zero", "albedo"):
            if body.get(field) != extra.get(field):
                problems.append({
                    "id": code,
                    "problem": f"{field} is {extra.get(field)!r} in "
                               f"the source, {body.get(field)!r} in "
                               f"the asset",
                    "asset": kind,
                    "source": "nasa.jpl.horizons",
                })
    matched = len(payload["bodies"]) - len({p["id"] for p in problems})
    return {
        "resolved": matched,
        "total": len(payload["bodies"]),
        "source": "nasa.jpl.horizons live",
        "problems": problems,
    }


def check_galaxies(payload: dict) -> dict:
    """Every galaxy resolves against a fresh RC3 query;
    name and measured redshift agree."""
    fresh = {
        record.source_id: record
        for record in galaxies.fetch()
    }
    problems: list[dict] = []
    for galaxy in payload["galaxies"]:
        pgc = str(galaxy["pgc"])
        record = fresh.get(pgc)
        if record is None:
            problems.append({
                "id": pgc,
                "problem": "pgc no longer in the RC3 query",
                "asset": "galaxies",
                "source": "cds.vizier.rc3",
            })
            continue
        extra = record.extra
        for field in ("name", "cz_km_s"):
            if galaxy.get(field) != extra.get(field):
                problems.append({
                    "id": pgc,
                    "problem": f"{field} is {extra.get(field)!r} in "
                               f"the source, {galaxy.get(field)!r} in "
                               f"the asset",
                    "asset": "galaxies",
                    "source": "cds.vizier.rc3",
                })
    matched = len(payload["galaxies"]) - len({p["id"] for p in problems})
    return {
        "resolved": matched,
        "total": len(payload["galaxies"]),
        "source": "cds.vizier.rc3 live",
        "problems": problems,
    }


def check_black_holes(payload: dict) -> dict:
    """Every transient resolves against a fresh A61
    query; name, distance and mass agree."""
    fresh = {
        record.source_id: record
        for record in black_holes.fetch()
    }
    problems: list[dict] = []
    for hole in payload["black_holes"]:
        recno = str(hole["recno"])
        record = fresh.get(recno)
        if record is None:
            problems.append({
                "id": recno,
                "problem": "recno no longer in the A61 query",
                "asset": "black-holes",
                "source": "cds.vizier.a61",
            })
            continue
        extra = record.extra
        for field in ("name", "distance_kpc", "distance_limit",
                      "mass_sun"):
            if hole.get(field) != extra.get(field):
                problems.append({
                    "id": recno,
                    "problem": f"{field} is {extra.get(field)!r} in "
                               f"the source, {hole.get(field)!r} in "
                               f"the asset",
                    "asset": "black-holes",
                    "source": "cds.vizier.a61",
                })
    matched = len(payload["black_holes"]) - len(
        {p["id"] for p in problems}
    )
    return {
        "resolved": matched,
        "total": len(payload["black_holes"]),
        "source": "cds.vizier.a61 live",
        "problems": problems,
    }
