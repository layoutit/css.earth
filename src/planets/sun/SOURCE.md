# Sun source and preparation

The Sun adapter uses one uniform planet-adapter contract. Its retained scene is
prepared from full-surface Carrington maps, not from a repeated Earth-facing
disc. The checked source manifest binds every input by byte count and SHA-256.

## Global surface sources

- Photosphere field: JSOC `hmi.mrsynop_small_720s[2311]`, the 720 x 360 radial
  magnetic-field map for Carrington Rotation 2311. The FITS grid is equally
  spaced in sine latitude. Preparation resamples it to equal latitude and uses
  a declared bipolar blue-to-amber false-colour scale.
- Chromosphere: NASA SDO AIA 304 angstrom CR2311 FITS synoptic map, 3600 x 1080.
- Corona: NASA SDO AIA 171 angstrom CR2311 FITS synoptic map, 3600 x 1080.

CR2311 covers 2026-05-12 through 2026-06-09. A synoptic map combines central
meridian observations across one solar rotation; it is a full-surface temporal
map, not a simultaneous snapshot. Preparation fills only missing AIA samples
from the nearest valid latitude in the same checked map. It performs no
runtime reconstruction.

The three pinned 2026-08-29 SDO browse images remain separate, Earth-facing
observations. AIA 304 and 171 contribute prepared off-limb context only to
their matching lenses. The photosphere off-limb asset is transparent. These
plates are stationary and sit behind the globe; they are never presented as a
rotating global surface.

## Retained renderer

PolyCSS maps the prepared 1024 x 512 global texture onto 448 retained
longitude-latitude leaves. Each pole adds 32 retained atlas-backed band leaves
and one retained center cap, for 514 visible surface leaves in total. Camera
pitch and yaw change the visible source texels, and the body animation rotates
actual global longitudes around the prepared solar axis.
There is no screen-aligned source-disc replacement and no flat-disc spin.
Because all longitudes converge at a pole, preparation tapers each source
sample to the same-latitude longitudinal mean near the cap centre, following
the Saturn adapter's polar-seam treatment. It does not introduce an independent
or invented pole source.

Each lens also has one source-derived, antialiased 512-pixel limb asset. It
covers only the outer retained-leaf rim to remove transform-raster faceting;
its transparent center does not replace the globe material. DPR 1 and DPR 2
surface, polar, limb, and off-limb banks are selected once per mount.

The retained cubic starfield is prepared from ESO/S. Brunier's photographic
`eso0932a` full-sky panorama at DPR 1 and DPR 2. The HYG v4.1 subset remains
the coordinate-registration audit input. The scene has no absolute observer
epoch, and the self-luminous Sun view deliberately does not bake a second Sun
into the cube. Camera pitch and yaw are unbounded accumulated matrix3d
rotations; the cube follows rotation without translation or parallax.

`node src/planets/sun/tools/verify-reproduction.mjs` prepares all runtime raster
assets in a temporary directory and requires every byte to match the accepted
runtime closure. Runtime performs no source derivation, image processing,
geometry construction, canvas, SVG scene rendering, or WebGL work.
