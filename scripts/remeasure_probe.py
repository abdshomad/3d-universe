"""JavaScript the re-measurement runs inside the page.

The snippets are kept apart from the measurement so
each file stays small enough to read. They reach the
app through its own published surface (window.__atlas)
or its own modules, so what is timed is the code that
ships, not a copy of it.
"""

# The modelled tier, toggled by scene membership. The
# app re-asserts layer visibility every frame, but a
# layer removed from the scene renders nothing, so the
# toggle holds.
TIER_OFF = """() => {
  for (const layer of window.__atlas.lss.levels) {
    window.__atlas.scene.remove(layer);
  }
}"""
TIER_ON = """() => {
  for (const layer of window.__atlas.lss.levels) {
    window.__atlas.scene.add(layer);
  }
}"""

# The modelled field's baked tile: fetch, parse and
# both LOD builds, timed with the app's own functions.
PARSE_COST = """async () => {
  const { parseField, createLssLayer } = await import('./src/render/lss-layer.js');
  const header = await fetch('../assets/tiles/lss-field.json').then((r) => r.json());
  const fetched = performance.now();
  const cube = await fetch('../assets/tiles/lss-field.bin').then((r) => r.arrayBuffer());
  const fetchMs = performance.now() - fetched;
  const parsed = performance.now();
  const field = parseField(header, cube);
  const parseMs = performance.now() - parsed;
  const built = performance.now();
  const levels = [1, 2].map((stride) => createLssLayer(field, { stride }));
  const buildMs = performance.now() - built;
  return {
    bytes: cube.byteLength,
    fetchMs: Number(fetchMs.toFixed(3)),
    parseMs: Number(parseMs.toFixed(3)),
    buildMs: Number(buildMs.toFixed(3)),
    cells: field.cells.length,
    points: levels.map((layer) => layer.userData.pointCount),
  };
}"""
