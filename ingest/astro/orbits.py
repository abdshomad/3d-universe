"""Orbital elements to positions, for the solar-system tier.

Positions are heliocentric ecliptic J2000 at the catalog epoch, then rotated
to equatorial so every source speaks the same coordinate language.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

AU_KM = 1.495978707e8
ARCSEC_PER_RAD = 206264.806247
OBLIQUITY_DEG = 23.4392911
MAX_KEPLER_ITERATIONS = 24


@dataclass(frozen=True, slots=True)
class OrbitalElements:
    """Classical elements at a given epoch."""

    a_au: float
    e: float
    i_deg: float
    om_deg: float
    w_deg: float
    ma_deg: float
    epoch_jd: float

    @property
    def perihelion_au(self) -> float:
        return self.a_au * (1.0 - self.e)


def eccentric_anomaly(mean_anomaly_rad: float, eccentricity: float) -> float:
    """Solve Kepler's equation by Newton iteration."""
    target = mean_anomaly_rad
    guess = target + eccentricity * math.sin(target)
    for _ in range(MAX_KEPLER_ITERATIONS):
        residual = guess - eccentricity * math.sin(guess) - target
        if abs(residual) < 1e-12:
            break
        guess -= residual / (1.0 - eccentricity * math.cos(guess))
    return guess


def heliocentric_ecliptic_km(elements: OrbitalElements) -> tuple[float, float, float]:
    """Position at the element epoch, heliocentric ecliptic J2000, in km."""
    e = min(max(elements.e, 0.0), 0.999)
    mean_anomaly = math.radians(elements.ma_deg) % (2 * math.pi)
    ecc_anomaly = eccentric_anomaly(mean_anomaly, e)

    a_km = elements.a_au * AU_KM
    x_orb = a_km * (math.cos(ecc_anomaly) - e)
    y_orb = a_km * math.sqrt(1.0 - e * e) * math.sin(ecc_anomaly)

    w = math.radians(elements.w_deg)
    om = math.radians(elements.om_deg)
    inc = math.radians(elements.i_deg)

    xp = x_orb * math.cos(w) - y_orb * math.sin(w)
    yp = x_orb * math.sin(w) + y_orb * math.cos(w)

    x = xp * math.cos(om) - yp * math.cos(inc) * math.sin(om)
    y = xp * math.sin(om) + yp * math.cos(inc) * math.cos(om)
    z = yp * math.sin(inc)
    return (x, y, z)


def ecliptic_to_equatorial(x: float, y: float, z: float) -> tuple[float, float]:
    """Rotate ecliptic J2000 to ICRS; returns (ra_rad, dec_rad)."""
    eps = math.radians(OBLIQUITY_DEG)
    x_eq = x
    y_eq = y * math.cos(eps) - z * math.sin(eps)
    z_eq = y * math.sin(eps) + z * math.cos(eps)
    dec = math.asin(z_eq / math.sqrt(x_eq * x_eq + y_eq * y_eq + z_eq * z_eq))
    ra = math.atan2(y_eq, x_eq) % (2 * math.pi)
    return (ra, dec)


def distance_pc_from_km(distance_km: float) -> float:
    return distance_km / (AU_KM * ARCSEC_PER_RAD)


def apparent_magnitude(absolute_mag: float, r_au: float, delta_au: float) -> float:
    """Standard inverse-square brightening; the phase term is ignored."""
    if r_au <= 0 or delta_au <= 0:
        return absolute_mag
    return absolute_mag + 5.0 * math.log10(r_au * delta_au)


def julian_to_iso(jd: float) -> str:
    """A Julian date to a calendar date (Fliegel-Van Flandern).

    The epoch a small body's elements are valid for is what makes
    its position a fact rather than a guess, so it is written as a
    date a person can read, not a bare Julian number.
    """
    z = int(jd + 0.5)
    fraction = (jd + 0.5) - z
    if z >= 2299161:
        alpha = int((z - 1867216.25) / 36524.25)
        z = z + 1 + alpha - int(alpha / 4)
    b = z + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)
    day = b - d - int(30.6001 * e) + fraction
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    return f"{year:04d}-{month:02d}-{int(day):02d}"


def earth_heliocentric_au(jd: float) -> tuple[float, float, float]:
    """Low-precision Earth position (JPL approximate elements, J2000 ecliptic).

    Accurate to a few thousand km over 1800-2050: plenty for placing an
    asteroid in a tile, and far cheaper than an ephemeris file.
    """
    t = (jd - 2451545.0) / 36525.0
    a = 1.00000261 + 0.00000562 * t
    e = 0.01671123 - 0.00004392 * t
    i_deg = -0.00001531 - 0.01294668 * t
    long_peri_deg = 102.93768193 + 0.32327364 * t
    mean_anomaly_deg = 357.52910918 + 35999.05029087 * t

    mean_anomaly = math.radians(mean_anomaly_deg % 360.0)
    ecc = eccentric_anomaly(mean_anomaly, e)
    x_prime = a * (math.cos(ecc) - e)
    y_prime = a * math.sqrt(1.0 - e * e) * math.sin(ecc)

    w = math.radians(long_peri_deg)
    inc = math.radians(i_deg)
    return (
        x_prime * math.cos(w) + y_prime * math.sin(w) * math.cos(inc),
        x_prime * math.sin(w) + y_prime * math.cos(w) * math.cos(inc),
        (x_prime * math.sin(w) + y_prime * math.cos(w)) * math.sin(inc),
    )