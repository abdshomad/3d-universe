"""Magnitude to brightness and colour index to RGB.

Shared by the bake and the renderer so a star cannot look like one brightness
here and another there.
"""

from __future__ import annotations

import math

MAGNITUDE_ZERO_POINT_FLUX = 1.0


def flux_ratio(mag: float | None, reference_mag: float = 0.0) -> float | None:
    """Relative flux against a reference magnitude."""
    if mag is None:
        return None
    return MAGNITUDE_ZERO_POINT_FLUX * (10.0 ** (-0.4 * (mag - reference_mag)))


def sprite_scale(mag: float | None, faint_mag: float = 12.0, bright_mag: float = 0.0,
                 min_px: float = 0.9, max_px: float = 9.0) -> float:
    """Point size in pixels, clamped: magnitudes run backwards, pixels do not."""
    if mag is None:
        return min_px
    span = max(faint_mag - bright_mag, 1e-6)
    t = (faint_mag - mag) / span
    t = min(max(t, 0.0), 1.0)
    return min_px + (max_px - min_px) * (t**0.5)


def temperature_k(color_index: float | None) -> float | None:
    """Effective temperature from B-V, via the Ballesteros relation."""
    if color_index is None:
        return None
    bv = float(color_index)
    if bv <= -0.4 or bv >= 2.0:
        # Outside the calibrated range; clamp instead of extrapolating wildly.
        bv = min(max(bv, -0.4), 2.0)
    return 4600.0 * (1.0 / (0.92 * bv + 1.7) + 1.0 / (0.92 * bv + 0.62))


def temperature_to_rgb(temp_k: float) -> tuple[float, float, float]:
    """Blackbody colour in sRGB, gamma-space approximation.

    Approximate by design: it drives point sprites, not photometry.
    """
    t = min(max(temp_k, 1000.0), 40000.0) / 100.0
    if t <= 66:
        red = 255.0
        green = 99.4708025861 * math.log(t) - 161.1195681661
        blue = 0.0 if t <= 19 else 138.5177312231 * math.log(t - 10.0) - 305.0447927307
    else:
        red = 329.698727446 * ((t - 60.0) ** -0.1332047592)
        green = 288.1221695283 * ((t - 60.0) ** -0.0755148492)
        blue = 255.0
    return tuple(min(max(c, 0.0), 255.0) / 255.0 for c in (red, green, blue))


def color_to_rgb(color_index: float | None) -> tuple[float, float, float]:
    """B-V straight to sRGB; falls back to a neutral grey when unknown."""
    temp = temperature_k(color_index)
    if temp is None:
        return (0.8, 0.82, 0.86)
    return temperature_to_rgb(temp)