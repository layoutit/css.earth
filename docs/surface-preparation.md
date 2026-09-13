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
| Restore missing inputs; reject changed bytes | [Acquisition](../tools/objects/operations.ts) and [checkout restoration](../tools/restore-source-inputs.mts) |
| Reproduce authored ellipsoid tables from pinned measurements | [Source table tools](../tools/objects/source-authoring/README.md) |
| Read the authored recipe and dispatch its capabilities | [prepareAuthoredObject](../tools/objects/prepare-authored.ts) |
| Prepare solid-body imagery, scientific layers and meshes | [prepareTerrestrialLayers](../tools/objects/terrestrial-layers/index.mts) |
| Record input, recipe and output identities | [Provenance bindings](../tools/objects/provenance-recipes.mts) and [record generation](../tools/objects/provenance.mts) |

The [implementation map](../.agents/skills/celestial-skill/references/implementation-map.md)
locates other preparation families. Earth selects among offline atlas levels
according to projected CSS size, independently of DPR; dataset selection remains
manual. These texture levels are separate from its retired geographic paging.
The [texture-level implementation and measurements](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/earth-prepared-texture-levels.md)
record that change; [Earth's README](../src/planets/earth/README.md) describes the
current datasets and retained source history. Other bodies prepare one surface
map per lens, at two texels per layout pixel, and declare no texture levels.

## Decode the source before choosing its display

### Preserve photographic detail through preparation

A large source can still produce a soft texture if preparation resizes it to an
intermediate map and then samples that map again for an atlas or pole. Trace the
actual path before increasing texture dimensions. Latitude-band packing itself
copies pixels and adds gutters; it does not need an image filter.

The direct photographic paths sample the pinned original grid at the final
texture coordinates. Terrain atlases use the existing leaf transforms and a
2 × 2 subpixel footprint. Polar sprites retain their existing projection and
footprint. Earth samples Blue Marble and clouds on their separate native grids,
then applies the declared display transfer and cloud composite. These changes
affect preparation, without adding faces, runtime work or decoded texture pixels.

Source coordinates, validity and presentation still govern the result:

- Respect pixel centres, map origins, positive-east/positive-west conventions
  and cropped extents. A projection's central meridian is not its left edge.
- Reject interpolation footprints that include missing source contributors.
  Apply the gray coverage grid afterwards; valid black pixels remain observations.
- Preserve required mosaicking, spectral calculations, photometric correction
  and authored presentation transforms. Bypassing a necessary composite is not
  an image-quality improvement.
- Resize an unpacked map before copying it into latitude bands. Filtering an
  already packed map can mix stored strips and their gutters.

Compare identical product views, including shadow settings, and keep encoding
quality fixed in a control comparison. Record compressed bytes separately from
decoded dimensions. A higher WebP quality can help independently of sampling;
neither method creates detail absent from the observations. Source coverage and
photograph-to-shape registration require their own evidence.

The current native sampling recipes cover these existing presentations:

| Preparation path | Bodies | Affected views |
| --- | --- | --- |
| Retained terrain atlases | Bennu, Deimos, Dione, Enceladus, Eros, Gaspra, Ida, Mathilde, Mimas, Phobos, Rhea, Ryugu, Steins, Tethys, Vesta | 22 photographic views |
| Spherical polar sprites | Ariel, Callisto, Ceres, Charon, Europa, Ganymede, Iapetus, Io, Mars, Miranda, Oberon, Pluto, Titan, Titania, Triton, Umbriel, Venus | 23 photographic views; latitude-band maps keep their existing pixels |
| Unpacked resizing | Mercury | Three 1× maps; the three canonical 2× maps reproduce their previous hashes |
| Paged surface and poles | Earth | Clear surface and cloud composite, including their existing lower resolution pages |
| Observed polar atlas | Neptune | Visible color; the atmospheric calibration remains before sampling |

This is not a blanket bypass of image processing. Controlled camera mosaics,
observed-color registration, scientific fields, solar products and giant-planet
composites keep the processing that defines their meaning. The Moon retains the
LROC mosaic delivered in #151; Europa and Io retain that change's 8K photographic
bands and Io's corrected feature positions. Low-resolution or unobserved source
areas cannot gain measured detail from this change.

The 12 September 2026 review used revision `3dc424757`: all 51 selected views
across 35 bodies were captured in Chromium at DPR 1 with Shadows on and off
(102 captures), then inspected for visible texture, coverage and lighting.
There were no script errors in those captures. Some unchanged scientific-view
thumbnails were unavailable in the local checkout; this was not a full catalogue
delivery or browser-conformance pass. [Earth's close-zoom limitation](../src/planets/earth/README.md#known-problems)
occurred with both the previous and new photographic bytes.

The [Enceladus comparison](../src/planets/enceladus/evidence/native-source-sampling.png)
separates source sampling from WebP quality at an identical camera position.
[Dione's enhanced-color capture](../src/planets/dione/evidence/native-source-enhanced.png)
shows a complete product view. These examples demonstrate the prepared result;
they do not establish new observational resolution or remove the sources' seams.
The [Enceladus Pixelmatch evidence](../src/planets/enceladus/README.md#evidence)
adds fresh matched crops on the `e0487eff5` / `c13f3643b` merge: Pixelmatch diffs
at threshold 0.1, an independent repeat, byte pins and reproduction commands.
Anti-aliasing is included. The repeat has zero mismatches; most photographic
changes are subtle.

On that merge, Europa's Monochrome and Io's Monochrome/Enhanced color views
were recaptured at DPR 1 with Shadows on and off (six inspected views, no script
errors). Their six native pole files reproduce their inventory hashes with the
merged preparer; their bands retain #151's hashes. Unselected scientific
thumbnails remained unavailable locally. The earlier 102 captures continue to
document their recorded revision; they are not relabeled as a new full sweep.

### Format and field references

- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation)
  defines mesh units, spin and coordinate frames. The body’s model record identifies
  the selected model, version and published fields. `Lambda` and `Beta` are the
  ecliptic pole in degrees; `Period` is in hours. Mesh volume and extents in our
  record are calculated from the original geometry, not copied from the webpage.
- [NEOWISE v2 column definitions](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html)
  define thermal-fit fields, units and flags. Keep the selected catalogue rows and
  their interpretation with the body.
- [JAXA/ISAS data policy](https://www.isas.jaxa.jp/en/researchers/data-policy/)
  describes reuse terms for AKARI data; the body NOTICE retains the attribution.
  AcuA v1 is restored through each body’s acquisition plan and checked against its
  manifest. Its selected measurements remain in the calibration record.

### Image and numeric readers

[readObservation](../tools/objects/terrestrial-layers/solid-raster.mts) selects
the decoder named by the recipe. Ordinary images use Sharp; PDS, FITS, ISIS and
GeoTIFF observations use format-specific readers that check the expected grid
and encoding. [Acquisition tools](../tools/objects/acquisition/) handle
instrument-specific calibration and geometry. The
[observation preparer](../tools/objects/terrestrial-layers/observed-geo-surface.mts)
also fits and validates cameras and applies photometric corrections.

[loadScienceSurface](../tools/objects/terrestrial-layers/scientific-raster.mts)
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
| Geographic or projected map | [scienceMapPoint](../tools/objects/terrestrial-layers/scientific-raster.mts) applies the declared projection; grid origin, spacing and pixel-center rules locate the sample. [Solid-body reprojection](../src/platform/prepare-solid-body-surface.mts) handles the display surface and poles. |
| Mesh with released UVs | [obj-uv-fits.mjs](../tools/objects/terrestrial-layers/obj-uv-fits.mts) keeps each face corner's original texture index, including seams. It transfers a prepared point to the closest original triangle within the recipe's distance limit. |
| Registered photograph | [observed-geo-surface.mjs](../tools/objects/terrestrial-layers/observed-geo-surface.mts) uses source geometry, camera validation and visibility checks. [observation-mosaic.mjs](../tools/objects/terrestrial-layers/observation-mosaic.mts) selects among qualified observations. |

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

A global map's west and east edges meet at one meridian. When a georeferenced
source spans 360° of longitude, to within one of its pixels, its recipe declares
`wrapLongitude: true`, and interpolation reads across that meridian. Without the
declaration, a target pixel whose footprint crosses the edge counts as missing
and receives the gray coverage grid. That drew a one-pixel line at 180° on Io's
8K maps. Preparation rejects the declaration for a source that does not span 360°.

![Gaspra detector image beside a reprojected mosaic, with four matching patches marked](images/gaspra-registration.png)

Gaspra registration example: detector image at left, published mosaic reprojected
through the archived camera at right. Compare the marked landmarks; the display
stretches differ. Both use related observations, so this is a registration check.
[Gaspra's README](../src/planets/gaspra/README.md) records the source, residuals and limits.

## Reduce geometry and bake the atlas

[radial-terrain.mjs](../tools/objects/terrestrial-layers/radial-terrain.mts)
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
For banded surfaces, [projective-surface-raster.mjs](../src/platform/projective-surface-raster.mts)
packs latitude bands and gutters; poles have separate prepared tiles.
Atlas dimensions, tile sizes and padding must agree with those addresses.
Padding hides sampling seams; it does not add observed coverage.

Chrome antialiases each leaf edge separately and paints each leaf's texture only
up to that edge. Two leaves that meet exactly therefore leave a faint see-through
line, and a magnified seam shows where one leaf's texels stop. A fixed overlap
that stretches the texture cannot hide both at every zoom. Venus's former 0.8%
overlap was 0.4 CSS pixels per edge at the default view, too little for every
edge, and 1.9 pixels at feature zoom, where the stretched texture showed as a
band along each seam.

When a [CSS geometry profile](../src/renderers/css/preparation/scene/profile.ts)
declares a seam outset, preparation writes two corrections instead:

- **Matched raster overscan.** Each surface leaf's texture address and its
  geometry both extend by half a canonical source texel, one displayed texel of
  real neighbouring imagery past each edge. A magnified seam then blends into the
  neighbouring texels.
- **Stepped seam outset.** Each surface leaf gets a scale per axis, and the body
  a table of silhouette steps
  ([seam-outset.ts](../src/renderers/css/preparation/scene/seam-outset.ts)). At
  runtime the body publishes the value for its projected diameter as
  `--surface-seam-outset`, and each leaf scales about its centre by
  `1 + outset × scale`. From a 16-pixel disc to the closest zoom, every step adds
  0.38–0.6 CSS pixels on each edge. The runtime only selects a prepared step.

[surface-seams-browser.mts](../site/test/surface-seams-browser.mts) measures the
result at saved Venus radar views. It renders each view over a black and then a
white backdrop to find pixels that let the backdrop through, and it compares the
brightness profile across each seam with parallel lines inside both leaves.
These corrections do not change breaks in the source imagery itself, such as
the one-pixel border columns at the edges of the Venus radar, Mars and Ceres
source maps.

[solid-raster.mjs](../tools/objects/terrestrial-layers/solid-raster.mts) writes
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
node --test tools/objects/terrestrial-layers/obj-uv-fits.test.mts
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

## Refresh photographs without rebuilding geometry

For a `density-before-pack` raster with separate pole sprites, a surface may set
`resolutionScale` to a positive integer. It multiplies that photograph's prepared
map size. Gutters scale with the map, preserving normalized
atlas coordinates; polar sprite dimensions, lighting and scene geometry stay fixed.
This setting does not change runtime texture selection or add a renderer feature.

After pinning the changed recipe and content, use the shared preparer:

```sh
pnpm build:preparation
node tools/objects/dist/refresh-photographs.js moon surface
node tools/objects/dist/refresh-photographs.js europa normal enhanced
node tools/objects/dist/refresh-photographs.js io normal enhanced
```

Run one body at a time. The command verifies the selected source closure, prepares
its images and small minimaps, and updates the existing asset inventories and
captions. It rejects scientific/emissive selections and new resource names.
Unselected maps and the scene remain retained products; provenance records this
as a partial refresh rather than a new full-package preparation. The ordinary
full preparer uses the same image code.

LROC's `pds-float-map` interpretation reads attached PDS3 labels, validates the
product version, band, projection and lunar reference sphere, then integrates
source pixel footprints before applying display gain/gamma. Source special values
are masked before sampling; observed black is retained. It reads one row strip
at a time and supplies the same interpretation to the globe and sidebar map.
