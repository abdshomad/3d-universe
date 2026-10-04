"""Does every pulsar in the atlas resolve back to the ATNF catalogue?

`ingest verify` does this for baked tiles. The event catalogue never had the
equivalent, and it turned out to matter: of the 598 pulsars the atlas draws,
**559 carry a distance derived from a dispersion measure** and only 39 carry a
parallax. Those are estimates, and the atlas places every one of them in 3D.

This asks two questions. Does every pulsar id resolve to a catalogue row? And —
the one that can surprise you — does ATNF hold a parallax for a pulsar this
catalogue says it does not, meaning a measured distance was available and was not
used?

Run directly: `python3 -m ingest.verify_events [events.json]`.
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from io import StringIO
from pathlib import Path

TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
CATALOGUE = "B/psr/psr"

CITATION = {
    "dataset": "ATNF Pulsar Catalogue (Manchester et al.)",
    "catalogue": CATALOGUE,
    "url": "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?source=B/psr/psr",
}


def query() -> str:
    """The whole ATNF catalogue: names, parallaxes, dispersion measures, periods."""
    adql = f'SELECT Name,PSRJ,Plx,DM,P0,RAJ2000,DEJ2000 FROM "{CATALOGUE}"'
    url = f"{TAP_URL}?{urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': adql})}"
    with urllib.request.urlopen(url, timeout=240) as response:
        return response.read().decode("utf-8")


def index_catalogue(csv_text: str) -> dict[str, dict]:
    """ATNF rows by name, keeping the row that actually carries a parallax."""
    rows = {}
    for row in csv.DictReader(StringIO(csv_text)):
        name = (row.get("Name") or "").strip()
        if not name:
            continue
        try:
            parallax = float(row["Plx"])
        except (TypeError, ValueError):
            parallax = None
        try:
            dm = float(row["DM"])
        except (TypeError, ValueError):
            dm = None
        existing = rows.get(name)
        # A pulsar can appear twice; the row with a parallax is the better one.
        if existing is None or (existing["plx"] is None and parallax is not None):
            rows[name] = {"plx": parallax, "dm": dm, "psrj": (row.get("PSRJ") or "").strip() or None}
    return rows


def check(events: list[dict], catalogue: dict[str, dict]) -> dict:
    """Resolve every event, and count what the catalogue could have told us."""
    resolved = 0
    unresolved = []
    parallax_backed = 0
    estimated = 0
    unused_parallax = []

    for event in events:
        name = (event.get("name") or "").strip()
        row = catalogue.get(name)
        if row is None:
            unresolved.append(event.get("id"))
            continue
        resolved += 1
        if event.get("distance_source") == "parallax":
            parallax_backed += 1
        else:
            estimated += 1
            # The finding this check exists for: a measured distance was
            # available and the catalogue is not using it.
            if row["plx"] is not None and row["plx"] > 0:
                unused_parallax.append({
                    "id": event.get("id"),
                    "name": name,
                    "atnf_parallax_mas": row["plx"],
                    "atnf_dm": row["dm"],
                })

    return {
        "events": len(events),
        "resolved": resolved,
        "unresolved": unresolved,
        "parallax_backed": parallax_backed,
        "estimated_from_dm": estimated,
        "unused_parallax": unused_parallax,
    }


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    path = Path(args[0]) if args else Path("assets/events/pulsars.json")

    events = json.loads(path.read_text(encoding="utf-8"))["events"]
    report = check(events, index_catalogue(query()))

    print(f"{report['resolved']}/{report['events']} pulsars resolve against ATNF ({CATALOGUE})")
    print(f"  distances from a parallax      : {report['parallax_backed']}")
    print(f"  distances from a dispersion DM : {report['estimated_from_dm']}")
    if report["unresolved"]:
        print(f"  UNRESOLVED ({len(report['unresolved'])}): {', '.join(report['unresolved'][:6])}")
    unused = report["unused_parallax"]
    if unused:
        print(f"  ATNF holds a parallax for {len(unused)} of the estimated ones:")
        for row in unused[:5]:
            print(f"    {row['id']}: {row['atnf_parallax_mas']} mas "
                  f"(DM {row['atnf_dm']}) was available and unused")
    print(f"  citation: {CITATION['dataset']} via VizieR")
    return 1 if report["unresolved"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
