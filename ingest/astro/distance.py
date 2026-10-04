"""Parallax to distance, with the edge cases that matter.

A star without a usable parallax has no 3D position. Returning None for those
cases is the mechanism that keeps invented distances out of the tile.
"""

from __future__ import annotations

import math

PARALLAX_MAS_PER_ARCSEC = 1000.0


def is_usable_parallax(parallax_mas: float | None) -> bool:
    """Reject NaN, zero, negative and non-finite parallaxes."""
    if parallax_mas is None:
        return False
    value = float(parallax_mas)
    if math.isnan(value) or math.isinf(value):
        return False
    return value > 0.0


def distance_pc(parallax_mas: float | None) -> float | None:
    """Distance in parsecs, or None when there is no usable parallax."""
    if not is_usable_parallax(parallax_mas):
        return None
    return PARALLAX_MAS_PER_ARCSEC / float(parallax_mas)