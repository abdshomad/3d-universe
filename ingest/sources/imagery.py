"""Public-domain telescope imagery for the deep-field backdrop.

NASA images are not measurements of the atlas geometry, but they are real
observations: each asset keeps its credit line and its landing page so the
fact card can cite it.
"""

from __future__ import annotations

from ingest.http import build_url, fetch_json, now_iso
from ingest.schema import MEASURED, ImageAsset, Provenance
from ingest.sources.base import provenance

name = "imagery"
release = "live"

ENDPOINT = "https://images-api.nasa.gov/search"
LANDING = "https://images.nasa.gov/details/{asset_id}"


def fetch_images(
    query: str = "webb deep field",
    limit: int = 12,
    endpoint: str = ENDPOINT,
    timeout: float = 60.0,
) -> list[ImageAsset]:
    """Search the NASA image library and return deep-field candidates."""
    params = {"q": query, "media_type": "image", "page_size": str(limit)}
    url = build_url(endpoint, params)
    payload = fetch_json(url, timeout=timeout)
    prov = provenance(
        catalog="nasa.images",
        release=release,
        query=url,
        source_url=url,
        fetched_at=now_iso(),
        flag=MEASURED,
    )

    assets: list[ImageAsset] = []
    for item in payload.get("collection", {}).get("items", []):
        asset = _to_asset(item, prov)
        if asset is not None:
            assets.append(asset)
    return assets


def _to_asset(item: dict, prov: Provenance) -> ImageAsset | None:
    data = (item.get("data") or [{}])[0]
    asset_url = _best_link(item.get("links") or [])
    if not data.get("nasa_id") or asset_url is None:
        return None
    asset_id = data["nasa_id"]
    return ImageAsset(
        asset_id=asset_id,
        title=(data.get("title") or asset_id).strip(),
        asset_url=asset_url,
        page_url=LANDING.format(asset_id=asset_id),
        credit=(data.get("center") or "NASA").strip(),
        provenance=prov,
    )


def _best_link(links: list[dict]) -> str | None:
    """The library tags assets by `rel`, not by size, so pick the large rendition."""
    alternates = [link["href"] for link in links if link.get("rel") == "alternate"]
    for href in alternates:
        if href.endswith("~large.jpg"):
            return href
    for link in links:
        if link.get("rel") == "preview" and link.get("href"):
            return link["href"]
    if alternates:
        return alternates[0]
    hrefs = [link["href"] for link in links if link.get("href")]
    return hrefs[0] if hrefs else None