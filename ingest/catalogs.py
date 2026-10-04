"""Catalog releases as data, not code.

Switching the atlas from one Gaia release to another is a JSON edit. The
registry refuses to hand out a release that has not been published, and says
why, so a bake cannot silently run against a table that does not exist.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CONFIG_PATH = Path(__file__).with_name("catalogs.json")


class CatalogError(RuntimeError):
    """An unknown or not-yet-published catalog release was requested."""


@dataclass(frozen=True, slots=True)
class Catalog:
    catalog: str
    release: str
    table: str
    endpoint: str
    columns: tuple[str, ...]
    available: bool
    note: str

    @property
    def key(self) -> str:
        return f"{self.catalog}/{self.release}"

    @property
    def column_list(self) -> str:
        return ", ".join(self.columns)

    def require_available(self) -> "Catalog":
        if not self.available:
            raise CatalogError(
                f"{self.key} is not published: {self.note}"
            )
        return self


def load_catalogs(path: str | Path | None = None) -> dict[str, dict[str, Catalog]]:
    """Read the registry, keyed by catalog family then release name."""
    raw: dict[str, Any] = json.loads(
        Path(path or CONFIG_PATH).read_text(encoding="utf-8")
    )
    registry: dict[str, dict[str, Catalog]] = {}
    for family, config in raw.items():
        releases: dict[str, Catalog] = {}
        for release, spec in config["releases"].items():
            releases[release] = Catalog(
                catalog=config["catalog"],
                release=release,
                table=spec["table"],
                endpoint=config["endpoint"],
                columns=tuple(config["columns"]),
                available=bool(spec.get("available", False)),
                note=spec.get("note", ""),
            )
        registry[family] = releases
    return registry


def get(family: str, release: str, path: str | Path | None = None) -> Catalog:
    """Look up one release, failing loudly when it is unknown or unpublished."""
    registry = load_catalogs(path)
    if family not in registry:
        raise CatalogError(f"unknown catalog family {family!r}; have {sorted(registry)}")
    releases = registry[family]
    if release not in releases:
        raise CatalogError(
            f"unknown release {release!r} for {family}; have {sorted(releases)}"
        )
    return releases[release].require_available()


def gaia_catalog(release: str = "DR3", path: str | Path | None = None) -> Catalog:
    return get("gaia", release, path)


def published_releases(family: str, path: str | Path | None = None) -> list[str]:
    registry = load_catalogs(path)
    return [name for name, cat in registry.get(family, {}).items() if cat.available]