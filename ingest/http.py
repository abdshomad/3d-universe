"""Minimal HTTP helper: one place for timeouts, retries and the user agent."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

USER_AGENT = "3d-universe-ingest/0.1 (https://github.com/abdshomad/3d-universe)"
DEFAULT_TIMEOUT = 120.0


class FetchError(RuntimeError):
    """A remote source could not be read after retries."""


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_text(url: str, timeout: float = DEFAULT_TIMEOUT, retries: int = 2) -> str:
    """GET a URL and return the body as text, retrying transient failures."""
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    raise FetchError(f"{url}: {last}") from last


def fetch_json(url: str, timeout: float = DEFAULT_TIMEOUT, retries: int = 2) -> dict:
    return json.loads(fetch_text(url, timeout, retries))


def build_url(base: str, params: dict[str, str]) -> str:
    return f"{base}?{urllib.parse.urlencode(params)}"