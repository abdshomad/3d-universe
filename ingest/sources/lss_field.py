"""A modelled large-scale density field.

This is **not** survey data. It is a Gaussian random field with a ΛCDM-like
linear matter power spectrum, generated from a fixed seed so the atlas shows the
same sky on every machine. It exists because the real thing cannot be had:
DESI DR1's per-region catalogues run to 16 GB apiece and the standard
pre-aggregated density cubes are unreachable from this host.

DESI DR1 (arXiv:2503.14745) is cited as the *science reference* for what real
large-scale structure looks like — not as the source of these numbers. Everything
downstream carries the SIMULATED flag for exactly that reason.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np

DATASET = {
    "kind": "modelled-density-field",
    "flag": "SIMULATED",
    "method": "Gaussian random field, ΛCDM-like linear matter power spectrum",
    "seed": 20261004,
    "science_reference": (
        "DESI Collaboration et al. (2025), Data Release 1 of the Dark Energy "
        "Spectroscopic Instrument, arXiv:2503.14745 (CC BY 4.0)"
    ),
    "honesty": (
        "A model of large-scale structure, not a survey map and not a DESI "
        "realisation. No galaxy in this field corresponds to a measured object."
    ),
}

DEFAULT_RADIUS_MPC = 500.0
DEFAULT_GRID = 96
QUANTISE_MAX = 255


def linear_power_spectrum(k: np.ndarray, pivot: float = 0.05) -> np.ndarray:
    """A smooth ΛCDM-like shape: rising as k on large scales, falling as k^-3.

    Shape, not precision: this is a field to look at, not a cosmology result.
    """
    k = np.maximum(k, 1e-12)
    rising = np.power(k / pivot, 1.0)
    falling = (pivot / np.maximum(k, pivot)) ** 3.0
    return rising * falling


def generate_field(grid: int = DEFAULT_GRID, radius_mpc: float = DEFAULT_RADIUS_MPC,
                   seed: int = DATASET["seed"]) -> np.ndarray:
    """Return a cube of densities centred on 1.0."""
    if grid < 8:
        raise ValueError("grid must be at least 8 cells a side")

    rng = np.random.default_rng(seed)
    noise = rng.normal(size=(grid, grid, grid))
    spectrum = np.fft.fftn(noise)

    freqs = np.fft.fftfreq(grid)  # cycles per cell
    k_magnitude = np.sqrt(
        (freqs[:, None, None] ** 2) + (freqs[None, :, None] ** 2) + (freqs[None, None, :] ** 2)
    )
    k_physical = 2 * math.pi * k_magnitude / grid * (2 * radius_mpc)  # Mpc^-1 scale
    spectrum *= np.sqrt(linear_power_spectrum(k_physical))

    field = np.real(np.fft.ifftn(spectrum))
    field -= field.mean()
    deviation = field.std()
    if deviation == 0:
        raise RuntimeError("degenerate field")
    return 1.0 + field / deviation


def quantise(field: np.ndarray) -> np.ndarray:
    """Densities to bytes, scaled so a void is 0 and a rich cluster is 255."""
    scaled = (field - FIELD_FLOOR) / (FIELD_CEILING - FIELD_FLOOR)
    return np.clip(np.rint(scaled * QUANTISE_MAX), 0, QUANTISE_MAX).astype(np.uint8)


FIELD_FLOOR = 0.35
FIELD_CEILING = 4.5


def build_payload(grid: int = DEFAULT_GRID, radius_mpc: float = DEFAULT_RADIUS_MPC) -> dict[str, Any]:
    field = generate_field(grid, radius_mpc)
    return {
        "dataset": DATASET,
        "grid": grid,
        "radius_mpc": radius_mpc,
        "cell_mpc": (2 * radius_mpc) / grid,
        "quantise": {"floor": FIELD_FLOOR, "ceiling": FIELD_CEILING, "max": QUANTISE_MAX},
        "bytes": quantise(field).tobytes(),
    }


def write_field(destination: str | Path, grid: int = DEFAULT_GRID,
                radius_mpc: float = DEFAULT_RADIUS_MPC) -> Path:
    """Write the field as a JSON header plus a binary cube."""
    payload = build_payload(grid, radius_mpc)
    header = {key: value for key, value in payload.items() if key != "bytes"}
    header["checksum"] = hashlib.sha256(payload["bytes"]).hexdigest()

    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(header), encoding="utf-8")
    target.with_suffix(".bin").write_bytes(payload["bytes"])
    return target
