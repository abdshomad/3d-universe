"""Does every pulsar resolve, and is a measured distance being left unused?"""

from __future__ import annotations

from ingest.verify_events import check, index_catalogue

CATALOGUE_CSV = """Name,PSRJ,Plx,DM,P0
"B0833-45","J0833-45",,43.7,0.089
"B0329+54","J0332+5434",0.94,26.76,0.714
"J0340+4130","J0340+4130",0.7,49.6,0.003
"""


def pulsar(name, distance_source):
    return {"id": f"pulsar:{name}", "name": name, "distance_source": distance_source}


def test_every_event_resolves():
    events = [pulsar("B0833-45", "dispersion-measure"), pulsar("B0329+54", "parallax")]
    report = check(events, index_catalogue(CATALOGUE_CSV))
    assert report["resolved"] == 2
    assert report["unresolved"] == []


def test_an_unknown_name_is_reported_by_id_not_dropped():
    report = check([pulsar("B9999-99", "dispersion-measure")], index_catalogue(CATALOGUE_CSV))
    assert report["resolved"] == 0
    assert report["unresolved"] == ["pulsar:B9999-99"]


def test_the_split_between_measured_and_estimated_is_counted():
    events = [
        pulsar("B0833-45", "dispersion-measure"),
        pulsar("B0329+54", "parallax"),
        pulsar("J0340+4130", "parallax"),
    ]
    report = check(events, index_catalogue(CATALOGUE_CSV))
    assert report["parallax_backed"] == 2
    assert report["estimated_from_dm"] == 1


def test_a_parallax_the_catalogue_is_not_using_is_reported():
    # B0833-45 is recorded as dispersion-measure here, but ATNF holds a parallax
    # for it. That is a measured distance available and left on the table, and
    # the check exists to say so.
    catalogue = index_catalogue(CATALOGUE_CSV)
    catalogue["B0833-45"]["plx"] = 0.55
    report = check([pulsar("B0833-45", "dispersion-measure")], catalogue)
    assert len(report["unused_parallax"]) == 1
    assert report["unused_parallax"][0]["atnf_parallax_mas"] == 0.55
    assert report["unused_parallax"][0]["id"] == "pulsar:B0833-45"


def test_a_negative_parallax_is_not_a_distance():
    catalogue = index_catalogue(CATALOGUE_CSV)
    catalogue["B0833-45"]["plx"] = -0.2
    report = check([pulsar("B0833-45", "dispersion-measure")], catalogue)
    assert report["unused_parallax"] == []


def test_a_duplicated_row_prefers_the_one_with_a_parallax():
    duplicated = CATALOGUE_CSV + '"B0329+54","J0332+5434",,26.76,0.714\n'
    catalogue = index_catalogue(duplicated)
    assert catalogue["B0329+54"]["plx"] == 0.94, "the parallax-bearing row wins"
