"""Sky coordinates to cartesian positions.

Positions are stored as unit vectors plus a distance in parsecs, which is the
form the tile writer and the renderer both want.
"""

from __future__ import annotations

import math

ARCSEC_PER_RAD = 206264.806247


def ra_dec_to_vector(ra_deg: float, dec_deg: float) -> tuple[float, float, float]:
    """ICRS right ascension / declination (degrees) to a unit vector."""
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    cos_dec = math.cos(dec)
    return (cos_dec * math.cos(ra), cos_dec * math.sin(ra), math.sin(dec))


def to_position_pc(
    ra_deg: float, dec_deg: float, dist_pc: float
) -> tuple[float, float, float]:
    """Cartesian position in parsecs, equatorial frame, origin at the observer."""
    ux, uy, uz = ra_dec_to_vector(ra_deg, dec_deg)
    return (ux * dist_pc, uy * dist_pc, uz * dist_pc)


def galactic_to_equatorial(l: float, b: float) -> tuple[float, float]:
    """Galactic (l, b) in degrees to ICRS (ra, dec) in degrees."""
    # North Galactic Pole and the galactic centre longitude, J2000.
    ra_ngp = math.radians(192.85948)
    dec_ngp = math.radians(27.12825)
    lon_ngp = math.radians(122.93192)

    dec = math.asin(
        math.sin(math.radians(b)) * math.sin(dec_ngp)
        + math.cos(math.radians(b)) * math.cos(dec_ngp) * math.cos(lon_ngp - math.radians(l))
    )
    y = math.cos(math.radians(b)) * math.sin(lon_ngp - math.radians(l))
    x = math.sin(math.radians(b)) * math.cos(dec_ngp) - math.cos(math.radians(b)) * math.sin(dec_ngp) * math.cos(
        lon_ngp - math.radians(l)
    )
    ra = (ra_ngp + math.atan2(y, x)) % (2 * math.pi)
    return (math.degrees(ra), math.degrees(dec))