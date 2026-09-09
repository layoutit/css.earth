# Callisto

Callisto (`504`) is a standalone satellite of Jupiter. The package uses the shared
object runtime, controls, input, camera and lighting contracts.

## Surface

The **Monochrome** lens uses the public-domain USGS
[Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km).
The original GeoTIFF is pinned in `source/manifest.json`: 15,138 × 7,569 pixels,
one 8-bit band, approximately 1 km grid spacing. Original observations range
from 400 m to 60 km per pixel. Coarse observed patches are retained; a fine grid
spacing does not make those patches high resolution.

USGS describes [Lunar–Lambert normalization and linear overlap matching](https://astrogeology.usgs.gov/search/map/callisto_voyager_galileo_image_mosaic_map)
in this mosaic family. We retain that processing. We do not run a second,
unconstrained flattening over a mosaic without its contributing image geometry.
Photographed crater relief and residual seams remain. The shared Shadows control
adds approximate globe illumination; it is available and retains its established
behavior. Shadows off keeps the shared curvature layer. No atmospheric halo is
rendered for the moon's extremely tenuous exosphere.

The GeoTIFF declares `GDAL_NODATA=0`. Only exact zero and pixels whose resampling
footprint includes that no-data are treated as missing. Preparation interpolates
premultiplied validity and withholds partially covered pixels, then paints the
shared neutral gray grid. Nonzero dark terrain stays observed terrain. No texture
or color is invented for gaps. No elevation product is supplied.

## Galileo color

The **Galileo color** lens uses the official USGS RGBA copy of NASA/JPL/DLR
[PIA03456](https://science.nasa.gov/photojournal/global-callisto-in-color/),
recorded in May 2001 and released on August 22, 2001. The
[USGS release](https://www.usgs.gov/media/images/callisto-galileo-ssi-color-mosaic)
marks it public domain. The original 646 × 653 PNG, release receipt, contemporaneous
C30 GREEN label, PDS image catalog and Gazetteer are retained beside the source.
These are published processed colors, not calibrated I/F, reflectance ratios or
measured albedo. No new radiometric correction or normalization is applied.
The roughly 640-pixel disk supplies approximately 8 km class detail near its
center; foreshortening worsens it toward the edge. Photographed shading, soft
detail and color fringing remain.

A frozen perspective camera registers the published plate to the independent
controlled USGS monochrome mosaic. The two training quadrants and two disjoint
held-out quadrants are recorded in `source/validation/galileo-color-registration.json`.
An independent review sampled the original 15,138 × 7,569 reference at its exact
GeoTIFF coordinates, without adjusting the fit: upper-right and lower-left
unblurred correlations were 0.713 and 0.573. Eight Gazetteer landmarks, including
Vili, Valfodr, Alfr, Bran and Loni, match the same visible impact structures. Local
0–1 pixel diagnostic offsets were never applied and do not establish a global
absolute positional accuracy. The original diagnostic scripts retain their
working paths for audit history; only the pinned conversion recipe is the
reproduction entry point.

The derived 1,440 × 720 PixelIsArea RGBA GeoTIFF uses 0–360° east longitude,
north-to-south rows, center longitude 180° and a 2,410,300 m sphere. That camera
radius is deliberately distinct from the reference mosaic’s 2,409,300.0488 m
cartographic radius. The converter samples only the original plate, bilinearly
in display-byte space, requiring every nonzero-weight contributor to have
alpha 255. It never reads reference-map texture while generating colors. An
explicit 65° emission limit retains **28.735%** of the sphere; unseen, grazing
and nonopaque source regions remain missing. Output no-data is all-zero RGBA,
with `GDAL_NODATA=0`; a valid all-zero RGB collision causes conversion to fail.
Valid dark terrain and pixels with only one zero color channel are retained.
The shared observation pipeline then resamples by the actual source georeference
and withholds any missing native contributor before painting the gray grid.
There is no globally filled color map. The 8,192-pixel runtime atlas adds display
sampling, not source resolution. Selecting this lens faces the observed hemisphere.

Reproduce the small checked-in source derivative with Python 3, numpy, Pillow and
rasterio:

`python3 src/planets/callisto/source/preparation/prepare-galileo-color.py`

The script checks the original and registration hashes before writing, and emits
`source/validation/galileo-color-conversion-proof.json` with the source, recipe,
generator, TIFF and raw RGBA hashes, grid, validity count and spherical coverage.
Use `--output-directory /tmp/callisto-reproduction` for an isolated comparison.
The raw RGBA/grid identity is portable; exact compressed TIFF bytes also depend
on the recorded GDAL/codec versions. Checked-in source files permit a normal
body bake without installing Python or regenerating this derivative.

## Coordinates and prepared assets

The source sphere radius is 2,409,300.0488 m. GeoTIFF projected x increases east
from 0° to 360°, centered on 180°; image rows run north to south. This is distinct
from the west-positive longitude *labels* in USGS's older catalog description.
For an independent landmark, [Valhalla](https://planetarynames.wr.usgs.gov/Feature/6284)
is at 14.7° N, 56° W (304° E), on the right side of the source raster. The source
prime meridian constant, 259.51° at J2000, agrees with the vendored IAU model.

Preparation downsamples to an 8,192 × 4,096 lossless map, bakes the projective
latitude bands with proportionally scaled gutters, and prepares 1,024-pixel
polar caps. These are selected once at every DPR. The scene is a mean-radius
sphere, not a measured terrain mesh: the astronomy package supplies 2,410.3 km.
The physical sphere radius and map's original cartographic reference radius
are kept distinct. No relief, bathymetry or interior model is inferred.

The existing astronomy package supplies JPL parent-relative orbital elements,
Jupiter's heliocentric position and IAU rotation at the shared prepared epoch.
The same presentation frame registers the moon, Sun, orbit and astrometric sky.
The orbital period is about 16.69 days and mean distance from Jupiter about
1,883,000 km. [NASA's facts](https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/)
provide the brief introductory content. A possible subsurface ocean is uncertain.

The Jupiter context photograph is pinned in Callisto's own source closure and
prepared into its own 1,024-pixel asset. Installing Callisto does not require
Jupiter's scene assets. ESO/S. Brunier imagery and the HYG catalogue supply the
same sourced sky as the established moon integration; their licenses are retained.

## Reproduce

- `node tools/objects/dist/operations.js acquire callisto --refresh` restores and verifies pinned inputs.
- `node tools/objects/dist/prepare-authored.js callisto --write` prepares the package.
- `node --test tests/objects/unit/callisto/*.test.mjs` checks source, pixels and runtime.
- `pnpm test:browser http://localhost:4210 callisto` checks Chrome DPR 1 and 2.
- `pnpm setup:assets --object=callisto` installs the published runtime closure without source preparation.

The original TIFF, font, panorama and parent photograph remain reacquirable,
ignored inputs. Runtime assets are independently described by `runtime-assets.json`.
Publication and isolated installation are separate from local source verification.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON.
Reusable observation masking, projection, lighting, celestial, and retained-scene
operations live in `tools/objects/terrestrial-layers/`. The source-only registered
color converter above produces a standard GeoTIFF; there is no body-specific
runtime or alternate body preparation path. Run `pnpm build:preparation` before the commands
above. Omit `--write` from preparation to generate an isolated comparison stage.

Delivery keeps the prepared HD texture dimensions. Surface and polar atlases use WebP quality 90 with full-quality alpha; source maps remain lossless. The shared photographic sky uses quality 95. Lighting stays lossless. Only the selected sky mode is requested on first view.

## B6 mapped science

The infrared view uses [the registered Galileo NIMS archive](https://doi.org/10.17189/4sq6-x165),
observations G8CNADLIND01A and G8CNGLOBAL02A, Minnaert-corrected CIOF products.
Following the archive guide, RGB selects same-parity bands near 0.77, 2.25 and
3.66 µm. The exact band centers vary slightly between observations and are
pinned in `source/nims/prepare-composite.json`. Fixed I/F display ranges are
R 0–0.45, G 0–0.45, B 0–0.2. The regional Asgard/Lindr observation has priority
in overlap. This is a partial spectral-color view, not natural color or a
mineral-abundance map. Source geometry follows the USGS 2013 registration grid.

Exact bytes, coordinates and validity rules are in the intake plans and receipts.
Reproduction: `tools/objects/acquisition/MAPPED-SCIENCE.md`.

The official USGS archive browser maps Individual Investigations to its working
CloudFront endpoint in [main.js](https://pdsimage2.wr.usgs.gov/index-style/js/main.js).
The original guides prescribe registered GeoTIFF geometry rather than COC
backplanes. Unobserved cells remain the shared gray grid; no gap fill is used.
