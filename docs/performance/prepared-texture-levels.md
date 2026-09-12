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

## Where the density pair came from

The `@2x` suffix and the `url`/`url2x` pairs in a prepared lens record are older
than levels. They named a device-pixel-ratio choice, one raster for a 1x display
and one for a 2x display, until the project settled on shipping the higher density
to every display as the canonical dataset. Levels are not that: they read the
projected silhouette and never the device.

That decision left the lower rasters in place. On the twenty-one bodies this change
levels, the manifests still declared 144 density-1 files, 50.1 MiB of published
bytes, that the accepted runtime plan reached through no resource at all — the
stylesheet pinned the canonical density, so no pixel could use them. Levelling
gives those exact files a job again as level 0; it adds no prepared raster.

The naming residue is still visible in the prepared lens records: across 472
bodies, 1655 density pairs name the same single file and only 192 name two real
densities. That is why the shared builder decides whether a layer can level by
comparing the two addresses rather than trusting the field names, and why 446
bodies have nothing to level.

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
write a single map and still give it the `@2x` suffix, then record it as both
addresses of the pair, so nothing is there for a level to select. This is where the
heaviest mounts in the project are: Phoebe warms 568.3 MiB, Mimas 488.3 MiB, and
Dione, Enceladus, Rhea and Tethys 378.3 MiB each — each one larger than anything
levelling recovered above.

A second density there is a preparation change, not wiring, and it is not a matter
of halving the existing atlas. Each density is packed independently with its own
gutter, as the giants' recipe shows at 10 and 20 texels, so a density-1 map has to
be reprojected and repacked with its own integer gutter or the band seams open.
That needs its own visual acceptance, on a lane whose bodies mostly cannot be
re-prepared without restoring their pinned science inputs: 46 of the 473 bodies
pass source closure on a fresh checkout.

**Uranus and Neptune now derive their levels but do not yet carry them.** The
layered lane reads the density-1 texel width from its own recipe, the last `resize`
that applies before packing: 1920 for Uranus, and 2880 for Neptune through its lens
transform. Both level their observed surface, Uranus levels its poles as well, and
Neptune's single-density poles correctly stay one resource. Their per-body tests
assert those thresholds and addresses.

Their prepared plans are unchanged, because refreshing either one also re-applies
shared presentation bindings their accepted runtime predates. That runtime no
longer reproduces from its own source on an unmodified checkout: its
`presentation-preparation` test fails at `camera.projection.axis`, and recompiling
moves the camera from a `cqw` perspective to `1000000px`, changes the dolly
distance bounds, and swaps the shared planet-marker atlas for per-body markers.
Those are behavioural changes unrelated to levels, so the two bodies gain their
levels once that divergence is resolved on its own; the mount decode waiting there
is 32.3 MiB for Uranus and 51.9 MiB for Neptune.

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
