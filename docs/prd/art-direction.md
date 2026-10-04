# Art Direction Spec — 3D Universe Atlas

Derived by frame-by-frame analysis of the two supplied references (sources and media listed in
[`../references.md`](../references.md)). This file is the visual contract for implementation; PRD
scope lives in [`universe-3d.md`](universe-3d.md).

## References (analyzed, not guessed)

**Ref A — `@_cosmicearth`** (6 s, 1080², 60 fps): a slow drift through a JWST-class ultra-deep
field. Full-bleed, zero chrome. Thousands of colored point sources; elongated comma-shaped smudges
(edge-on galaxies); grey-brown dust filaments and voids; soft halos on bright stars; one red nebular
knot. Its whole message is *volume and density* — the frame reads as 3D because of parallax.

**Ref B — `@RuiHuang_art`, "Encyclopedia Cosmologica" / 宇宙百科全书** (53 s, 2874×1440): near-black
canvas, faint nebulosity, glowing nodes with anamorphic starbursts joined by thin multi-hue light
ribbons, each node ringed by thin wireframe reticles; scattered "+" spark markers; minimal chrome
(title lockup top-left, thin top nav, bottom-left fact card with image thumbnail + spec list,
bottom-center boxed numeric readout, small red badge bottom-right). Message is *legibility inside
beauty*.

**Fusion:** Ref A is the **medium** — what fills the frame when you fly. Ref B is the **language** —
how objects, relations, and facts are drawn on top of it.

## Palette

| Role | Value |
|---|---|
| Void / background floor | `#05060A` (never pure black — bloom needs a floor) |
| Node core | `#FFF8F0` |
| Ribbon: cyan / magenta / gold / violet / white | `#7FE9D8` `#E86AC8` `#E9C46A` `#9B7BE8` `#FFFFFF` |
| Reticle lines | `rgba(255,255,255,0.55)`, 1 px screen-space |
| Spark markers | `#E5484D` `#4DA6FF` `#E9C46A` |
| Muted type | `#8A8F98` |

Rule: hue carries *meaning*, never decoration (see Relations).

## Layer stack (back to front)

1. **Deep field** — public-domain telescope imagery (NASA/ESA/ESO) tiled and oriented, plus
   procedural nebulosity, at 3–5 parallax depths. Never a flat skybox.
2. **Star dust** — two instanced point layers (far: 1 px, near: soft sprite) with mild parallax.
3. **Measured objects** — additive point sprites; size/brightness from magnitude, RGB from B−V.
4. **Relations** — tapered ribbons between objects that have a *cited* relation.
5. **Reticles** — wireframe annotation around a selected object: concentric circles, tick arcs,
   crosshair, parallax/uncertainty ellipse.
6. **Spark markers** — small colored `+` glyphs for transient/event objects.
7. **HUD** — minimal chrome (see below), never more than ~8 % of frame area.

## Technique notes

- **Ribbons**: quadratic-Bézier strips, width tapering to zero at both ends, additive blend, alpha
  modulated by a low-frequency noise so they read as painted light rather than vector strokes.
- **Starbursts**: quad sprite with a cross/hexagonal anamorphic flare and slight chromatic dispersion
  per channel. Intensity scales with apparent magnitude.
- **Reticles**: screen-space-constant line width (`Line2`-style), low alpha, drawn unlit so they never
  pick up scene lighting.
- **Post**: bloom (low threshold, moderate strength) → ACES filmic tonemap → slight vignette. The
  background floor must survive tonemapping or the void turns flat.
- **Motion**: constant slow drift + long ease curves. No cuts, no fast pans, no bounce. Scale
  changes are exponential and continuous — the camera never "jumps".

## Relations → hue

| Relation | Hue |
|---|---|
| Constellation line | white, thin |
| Exoplanet host → planet | gold |
| Binary / multiple system | cyan |
| Galaxy → cluster / group membership | violet |
| Pulsar / FRB / GW event localization | magenta |
| Simulation or synthesized link | magenta + dashed (visibly non-measurement) |

Every edge carries a citation in the data model. A ribbon with no citation does not render.

## HUD

- **Title lockup**, top-left: mark + product name + one-line subtitle, uppercase, 11–13 px,
  letter-spaced, `--muted`.
- **Top nav**: thin strip, 3–5 items, no chrome boxes.
- **Fact card**, bottom-left: 96 px thumbnail + name + 4–6 parameter rows + provenance line.
  Only for the selected object.
- **Readout**, bottom-center: three boxed numbers — objects in view, distance range, data source.
  This is the one place raw numbers are allowed.
- **Badge**, bottom-right: provenance state (MEASURED / SIMULATED) for the current region.
- Typography: thin geometric sans, uppercase, wide tracking, low contrast against the void.

## Anti-goals

- No lens flares as garnish, no chromatic aberration sweeps, no lens dirt.
- No arbitrary spaghetti edges between unrelated objects.
- No UI covering the frame; if the HUD grows, the scene is wrong.
- Never render invented structure without the SIMULATED badge.