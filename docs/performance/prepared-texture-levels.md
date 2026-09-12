# Prepared texture levels

Current architecture (2026-09-12): every prepared body that the in-renderer
presentation compiler owns declares prepared layer levels, and the shared
selection swaps them by projected silhouette. Before this change only Mercury
and Earth did, because levels were gated on the row-bank cutaway presentation
and because the published stylesheet, not the runtime, chose which density each
composite body painted.

Levels are a property of the prepared layers, not of a material mode. One shared
builder owns the rule for the in-renderer compiler and the object tools
(`src/platform/prepared-texture-levels.mts`). A layer the raster recipe wrote at
densities 1 and 2 over one atlas layout becomes two levels. The leaves size their
backgrounds in CSS pixels, so a level changes only the prepared address: nothing
is resampled offline or at runtime, and device pixel ratio is never an input.

## The rule

A disc `d` CSS pixels across shows half the equator, so a map `W` texels around
360 degrees gives `W / (pi * d)` texels per CSS pixel at the disc centre. The
higher density is needed once the lower one would give fewer than the authored
`texelsPerCssPixel`, which is two:

```
minimumDiameter = W / (pi * texelsPerCssPixel)
```

One threshold governs a whole body, taken from the surface map that covers the
whole disc. The other layers ride that switch rather than carrying thresholds of
their own, because the prepared transport does not carry each layer's own mapping
of texels to screen. Measured across the ringed giants, a body switching at its
surface threshold holds its rings, poles and material layers between 1.6 and 2.8
texels per CSS pixel against an authored 2. Hysteresis is a fifth, so a body that
switched up at 326 pixels switches back at 261.

## What the runtime had to own first

The composite presentation published no texture writes. Each body's surface and
poles address was pinned in `planet-surfaces.css`, one `!important` rule per body,
per lens, per layer, always at density 2 — 130 rules across twenty bodies. A
prepared level could not reach a pixel through that, and the mesh leaves carried a
baked density-1 address the stylesheet overrode.

The published rule now reads the layer's own custom property, which the prepared
variant writes for the selected lens and level: two rules per body instead of
130, and the runtime owns the density. The leaves keep their baked address as the
value the property replaces; no leaf is written per mount.

## Measured startup decode

Decoded bytes of the resident set each mount warms, from the prepared manifests
(width by height by four, per prepared raster named in `assets.startup`).

| Body | Before | After | Saved | Threshold |
| --- | --- | --- | --- | --- |
| Triton | 729.7 MiB | 280.3 MiB | 449.4 MiB | 1141 px |
| Charon | 608.6 MiB | 250.0 MiB | 358.6 MiB | 1019 px |
| Callisto | 327.5 MiB | 179.8 MiB | 147.8 MiB | 652 px |
| Ganymede | 327.5 MiB | 179.8 MiB | 147.8 MiB | 652 px |
| Iapetus | 327.5 MiB | 179.8 MiB | 147.8 MiB | 652 px |
| Titan | 327.5 MiB | 179.8 MiB | 147.8 MiB | 652 px |
| Miranda | 251.5 MiB | 160.8 MiB | 90.8 MiB | 509 px |
| Sun | 27.2 MiB | 6.8 MiB | 20.4 MiB | 163 px |
| Venus | 54.4 MiB | 43.8 MiB | 10.6 MiB | 163 px |
| Mars | 91.0 MiB | 52.9 MiB | 38.1 MiB | 326 px |
| Ariel, Ceres, Eris, Europa, Io, Makemake, Moon, Oberon, Pluto, Titania, Umbriel | 181.3 MiB each | 143.2 MiB each | 38.1 MiB each | 326 px |

Across the twenty-one bodies the mount set falls from 5066.2 MiB to 3088.7 MiB,
a 39% reduction. Mercury and Earth already levelled and are unchanged; Mercury's
prepared output is byte-identical, which is the parity evidence that the shared
builder reproduces the row-bank helper it replaced.

## What each body's own view settles on

Measured by opening every body at 1600 by 1000 and recording the level the
selection settled on and the surface densities the page actually fetched
(headless Chromium, dev server, fourteen seconds after load).

Six bodies never fetch the high density in their own view, because their maps are
large enough that the threshold sits above the disc their page shows: Callisto,
Charon, Ganymede, Iapetus, Titan and Triton. Their saving is the whole difference
in the table, 1399.2 MiB of decode that no longer happens.

The other sixteen settle on the high level and fetch both: the mount paints the
low level first and the resolved frame upgrades it. For those bodies the first
paint is cheaper and unblocked, but the steady state decodes the low map as well
as the high one. That is the progressive policy the shared selection already
applied to Mercury and Earth, where the mount deliberately takes the lowest level
(`selectPreparedTextureLevel` with `initial`) rather than blocking first paint on
the largest map. Choosing the mount level from the initial camera instead would
remove the extra decode for those sixteen while keeping the six; it changes shared
selection semantics for Mercury and Earth too, so it is left as its own change.

## What remains resident

The 143.2 MiB floor on the smaller bodies is the Lambert lighting bank: the
`shadowless` plate, the billboard atlas and the warm row shards. The recipe writes
those at one density only, so they have no lower twin to level to. A smaller
density for that bank is the next measurable step and is larger than anything
levelling recovered on those bodies.

The composite material plane carries its own projection and frame addressing
rather than a whole-body map, so it is not one of the levelled layers.

## What the rest of the registry needs

Levels reach 23 of the 473 prepared bodies. The other 450 fall into three cases,
counted from their prepared manifests.

**446 bodies write one prepared density.** The shape-model and static raster lanes
emit only the `@2x` map, with no lower twin on disk, so there is nothing for a
level to select. Their recipes have to write a second density first. This is where
the heaviest mounts in the project are: Phoebe warms 568.3 MiB, Mimas 488.3 MiB,
and Dione, Enceladus, Rhea and Tethys 378.3 MiB each — each one larger than
anything levelling recovered above. It is also the largest change, because a
second density is new prepared raster data for 446 packages.

**Uranus and Neptune are levelable today**, worth 32.3 MiB and 51.9 MiB of mount
decode. Their layered lane paints through texture writes already; what it lacks is
the density-1 texel width the threshold needs. That width is derivable from the
observation recipe — the last `resize` that applies before packing, 1920 for Uranus
and 2880 for Neptune through its lens transform — so this is wiring, not new data.

**Jupiter and Saturn publish no texture writes at all**, so they need the same
address-ownership move the composite bodies took here before a level can reach one
of their pixels.

## How it was applied

`tools/objects/refresh-presentation.ts` recompiles the retained presentation of an
already prepared object from the prepared inputs the compiler consumes, and
rewrites the runtime plan, its shared twin, the page metadata and the descriptor
pin. It re-prepares no surfaces, which keeps the change to what the presentation
owns and lets the three bodies whose pinned science inputs are not checked in
(Eris, Iapetus, Titan) take the same recompilation as the rest.
