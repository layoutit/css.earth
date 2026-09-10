# Image and surface preparation

Use this guide when changing how an image or mesh becomes a CSS surface.
The body's recipe selects the inputs, method and parameters. Shared tools do
the processing; the browser loads the resulting images and scene data.

```text
Original images, meshes and labels
  → verify bytes and decode values
  → locate each sample on the source surface
  → bake texture tiles, geometry and lighting
  → write prepared assets and provenance
```

## Find the processing step

| Step | Implementation |
| --- | --- |
| Restore missing inputs; reject changed bytes | [Acquisition](../tools/objects/operations.ts) and [checkout restoration](../tools/restore-source-inputs.mjs) |
| Reproduce authored ellipsoid tables from pinned measurements | [Source table tools](../tools/objects/source-authoring/README.md) |
| Read the authored recipe and dispatch its capabilities | [prepareAuthoredObject](../tools/objects/prepare-authored.ts) |
| Prepare solid-body imagery, scientific layers and meshes | [prepareTerrestrialLayers](../tools/objects/terrestrial-layers/index.mjs) |
| Record input, recipe and output identities | [Provenance bindings](../tools/objects/provenance-recipes.mjs) and [record generation](../tools/objects/provenance.mjs) |

The [implementation map](../.agents/skills/celestial-skill/references/implementation-map.md)
locates other preparation families. Earth selects among offline atlas levels
according to projected CSS size, independently of DPR; dataset selection remains
manual. These texture levels are separate from its retired geographic paging.
The [texture-level implementation and measurements](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/earth-prepared-texture-levels.md)
record that change; [Earth's README](../src/planets/earth/README.md) describes the
current datasets and retained source history.

## Decode the source before choosing its display

[readObservation](../tools/objects/terrestrial-layers/solid-raster.mjs) selects
the decoder named by the recipe. Ordinary images use Sharp; PDS, FITS, ISIS and
GeoTIFF observations use format-specific readers that check the expected grid
and encoding. [Acquisition tools](../tools/objects/acquisition/) handle
instrument-specific calibration and geometry. The
[observation preparer](../tools/objects/terrestrial-layers/observed-geo-surface.mjs)
also fits and validates cameras and applies photometric corrections.

[loadScienceSurface](../tools/objects/terrestrial-layers/scientific-raster.mjs)
keeps numeric values available for sampling. Unit conversion, palette and
optional relief follow that sampling. The displayed RGB value is therefore a
presentation of the source quantity; it cannot replace the original numeric input.

Validity comes from the selected product's mask, alpha or no-data rule. Numeric
bilinear sampling rejects a footprint containing an invalid neighbor. Categorical
and quality-mask paths use their declared sampling rules. Some image paths use
other resampling methods; inspect the selected decoder before changing them.
The [coverage guidance](../.agents/skills/celestial-skill/references/surface-preparation.md#coverage)
explains why darkness alone cannot define missing data.

![Cassini VIMS maps with observed patches surrounded by gray missing coverage](images/cassini-coverage.png)

Cassini VIMS example: infrared false color at left, ice absorption at right;
gray marks unsupported data. The [original input record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/source-review/source-maps.json)
identifies the cubes and processing behind this illustration.

## Map a surface point to source pixels

UV coordinates locate a point in an image. Source UVs select the original values;
atlas coordinates locate the baked tile that the CSS surface will display.

| Source representation | How sampling works |
| --- | --- |
| Geographic or projected map | [scienceMapPoint](../tools/objects/terrestrial-layers/scientific-raster.mjs) applies the declared projection; grid origin, spacing and pixel-center rules locate the sample. [Solid-body reprojection](../src/platform/prepare-solid-body-surface.mjs) handles the display surface and poles. |
| Mesh with released UVs | [obj-uv-fits.mjs](../tools/objects/terrestrial-layers/obj-uv-fits.mjs) keeps each face corner's original texture index, including seams. It transfers a prepared point to the closest original triangle within the recipe's distance limit. |
| Registered photograph | [observed-geo-surface.mjs](../tools/objects/terrestrial-layers/observed-geo-surface.mjs) uses source geometry, camera validation and visibility checks. [observation-mosaic.mjs](../tools/objects/terrestrial-layers/observation-mosaic.mjs) selects among qualified observations. |

For released OBJ UVs, the matched triangle supplies three barycentric weights:
fractions describing the point's position within that triangle. The sampler
uses those weights to interpolate its three corner UVs, then reads the image:

```text
u = weightA × uA + weightB × uB + weightC × uC
v = weightA × vA + weightB × vB + weightC × vC
x = u × width − 0.5
y = (flipV ? 1 − v : v) × height − 0.5
```

The reader clamps these pixel coordinates to the image edges. `flipV` is explicit
because file row order can differ from texture-coordinate order. [Arrokoth](../src/planets/arrokoth/README.md)
is a worked example with independent PNG/FITS anchors. Adjacent triangles can
tie for the closest point at a seam; a distance bound alone does not prove which
triangle supplies the correct texel.

The current released-UV path accepts triangular OBJ geometry and float32 FITS
maps. It samples the original UVs during baking; the reduced mesh receives new
atlas addresses.

Longitude direction, latitude convention, physical scale, pole and meridian
belong to the source recipe. A generic image resize cannot establish them.

![Gaspra detector image beside a reprojected mosaic, with four matching patches marked](images/gaspra-registration.png)

Gaspra registration example: detector image at left, published mosaic reprojected
through the archived camera at right. Compare the marked landmarks; the display
stretches differ. Both use related observations, so this is a registration check.
[Gaspra's README](../src/planets/gaspra/README.md) records the source, residuals and limits.

## Reduce geometry and bake the atlas

[radial-terrain.mjs](../tools/objects/terrestrial-layers/radial-terrain.mjs)
supports both a sampled radial surface and reduction of the original mesh.
A radial surface supplies one radius per direction. `source-meshoptimizer`
reduces source triangles instead; it can retain surfaces that a single radius
cannot describe. Face budgets, open boundaries and error limits are checked by
that path. The simplifier's error estimate and the measured source-transfer
distance are separate quantities.

![Nine asteroid pairs comparing each original source mesh with its reduced mesh](images/mesh-source-comparison.webp)

Mesh reduction example: each pair shows the source mesh at left and prepared mesh
at right. Each is normalized to its own maximum radius, so compare shape rather
than physical scale. The [original comparison method](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/main-belt-asteroids.md)
records the camera settings and remaining views. These three illustrations are
historical processing examples, not new browser checks.

For mesh surfaces, preparation samples each retained triangle into its own
raster tile and emits a native PolyCSS `u` triangle with prepared CSS addresses.
Ordinary mapped imagery is sampled from the lossless surface map at this step.
For banded surfaces, [projective-surface-raster.mjs](../src/platform/projective-surface-raster.mjs)
packs latitude bands and gutters; poles have separate prepared tiles.
Atlas dimensions, tile sizes and padding must agree with those addresses.
Padding hides sampling seams; it does not add observed coverage.

[solid-raster.mjs](../tools/objects/terrestrial-layers/solid-raster.mjs) writes
WebP assets and records their dimensions, sizes and hashes. Normalized maps stay
lossless; banded display output defaults to lossless unless the recipe selects
a quality setting. Ordinary triangle atlases default to WebP quality 90.
`pds3-scalar-map`, `facet-scalars`, `vtk-cell-categories` and `obj-uv-fits` atlases
use lossless output, as do nearest-sampled layers and image-plane DEMs.
Check decoded pixels after encoding. Rebuild affected atlases and CSS addresses
together when their layout changes.

## Run and check a change

Use the [build and preparation commands](../.agents/skills/celestial-skill/references/implementation-map.md#commands-and-test-routing)
to build the tools, restore inputs and prepare the selected body. For example,
after building the tools and restoring Arrokoth's inputs:

```sh
node tools/objects/dist/operations.js acquire arrokoth --verify-only
node tools/objects/dist/prepare-authored.js arrokoth --write
node --test tools/objects/terrestrial-layers/obj-uv-fits.test.mjs
```

The UV test checks interpolation, row order, missing values and bounded transfer.
For the changed body, compare independent source coordinates or numeric anchors,
then decode the corresponding atlas texels. Inspect the rendered seam, poles,
silhouette and coverage boundaries. Shared browser conformance checks interaction;
it cannot establish scientific registration.

Put the body's selected parameters, source interpretation and measured limits
in its README and recipe. Keep shared algorithm explanations here. Add a
[provenance binding](object-provenance.md#ownership-and-data-flow) when a new
operation consumes inputs or emits products, and retain its original check results
under the [evidence rules](provenance/CONTRACT.md#save-enough-evidence-to-check-the-result).
