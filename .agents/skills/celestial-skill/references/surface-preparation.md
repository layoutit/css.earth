# Preparing source-backed appearance

Read the section relevant to the source before choosing its processing recipe.
Keep original inputs intact and record transformations and limitations in the
body's source record. Reuse helpers from the [implementation map](implementation-map.md);
their algorithms are reusable, their body-specific parameters are not defaults.

Paged ellipsoids can declare `material.shadowlessOverlay` with RGB byte values
and an opacity from 0 to 1. This changes only the prepared Shadows-off overlay;
an omitted setting retains the black shading. The asset preparer's `shadowless`
mode rebuilds that overlay at both densities without rebuilding surface imagery
or directional lighting. Treat a light-colored overlay as a display adjustment,
not a physical illumination measurement.

## Photographic observations

Before increasing a texture budget, trace all resizes between the original
observation and the delivered atlas. Prefer sampling the pinned original grid
at the final atlas/pole footprint where the existing registration permits it.
Keep necessary mosaics, spectral calculations and presentation transforms.
Resize unpacked maps before copying latitude bands and gutters. Compare a
matched-encoding control so compression changes are not attributed to sampling;
report compressed bytes and decoded pixels separately. See the shared
[photographic preparation guide](../../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation).

First separate source resolution, acquisition illumination, exposure steps and
projection errors. Enlarging a coarse insert will not restore detail; brightness
matching will not fix a displaced map. Prefer a suitable already-corrected source
before building a new correction. Check its provenance for interpolation/fill,
annotations, color enhancement and remaining photographed shading.

For multiple photographs projected onto a surface, also read
[registered photographic mosaics](registered-photographic-mosaics.md) for camera
validation, surface correspondence, observation selection and coverage evidence.

For an existing single-model observation lens with unchanged geometry, use the
[observation refresh command](../../../../docs/surface-preparation.md#refresh-photographs-without-rebuilding-geometry)
to prepare only the selected imagery and its delivery records. It checks the
retained atlas against the source recipe and reuses the full preparer's owners.
Run one body at a time; alternative models or source-lighting changes need full
preparation. A faster refresh still requires source and visual qualification.

When baked illumination needs correction, try the following in preparation:

1. Bind each contributing observation/band to capture time, Sun and observer
   vectors, units, epoch scale, radius and the map's body frame. Resolve differing
   prime meridians between legacy labels and controlled map products. Pinned ISIS
   metadata plus [Horizons vectors](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
   transformed using the source's [PCK model](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html)
   are one supported route; disclose ephemeris differences.
2. Apply a photometric model to calibrated linear radiance/I/F before
   compositing and display encoding. Prefer a published model fitted to the same
   instrument and filter: transcribe it into a `source/photometry/<id>.json`
   record, cite its publication with a `method` binding whose locator names the
   table, and name it from the recipe with a reference geometry and limits (see
   `tools/photometry/README.md`). [ISIS photomet](https://isis.astrogeology.usgs.gov/9.0.0/Application/presentation/Tabbed/photomet/photomet.html)
   describes the same reference-geometry normalization. Record filter and
   fitted-range mismatches. Without a published parameter set, a route's
   historical empirical form remains; label it an approximation. Neither implies
   measured albedo. Withhold unreliable **source samples** using acquisition
   incidence, emission, phase and bounded gain, updating coverage. This does not
   restrict runtime views.
3. Where exposure steps remain, try one robust bounded brightness multiplier per
   coherent observation from co-located valid imagery near boundaries. Apply the
   same gain to RGB to preserve ratios, cap it to avoid clipping, and exclude
   gaps from the fit. Check multiple boundaries; a global fit can improve one
   edge and worsen another. Keep this display adjustment distinct from physics.

If metadata is insufficient, use a suitable corrected product or retain and
disclose the illuminated observation. A presentation adjustment must not be
described as calibrated albedo recovery. None of these methods reconstructs
terrain hidden in cast shadows or missing spectral bands. Preserve the app's
lighting controls, and inspect the result with Shadows on and off.

Color and monochrome may have different useful coverage and resolution. If the
chosen view composes them, preserve observed monochrome where color is absent;
mark gaps where neither supplies data. Do not infer neutral color, copy grayscale
detail into color bands, or silently change independent lenses into a composite.

## Scientific maps

Numeric GeoTIFFs may use geographic degrees rather than projected metres.
Read the native GeoKeys, origin, pixel area convention and NoData before choosing
`grid.coordinates: "degrees"`; the numeric reader verifies angular units, the
reference sphere and prime meridian. Do not multiply an already angular grid by
the radius. A declared NoData value may never occur in the raster; inspect the
actual value distribution and producer legend before treating extrema as gaps.
Keep any conservative exclusion explicit in the recipe and dataset description.

Choose labels by meaning through the shared lens vocabulary: Elevation,
Enhanced color, Thermal infrared, Cross section where those concepts apply.
Instrument, wavelength, datum, enhancement and caveats belong in descriptions.

For multi-extension FITS scalar maps, select and check the named quantity,
units and fit version explicitly; image dimensions alone cannot distinguish
fractions, errors and temperature. The shared `fits-image-map.mts` reader
accepts an explicit full-world map domain. Missing WCS requires a cited map
reference and orientation check. Inspect finite initialization values as well
as NaN: Pluto LEISA's uncomputed cells retain a complete parameter tuple.
Keep inferred missing-data signatures and authored uncertainty cutoffs visible
in the body's method notes; neither is a provider confidence mask.

For elevation, color encodes height while hillshade can make terrain readable.
Prefer suitable sourced shaded relief or derive relief from the body's real
elevation model. Use its datum, radius, longitude/latitude convention and
latitude-dependent pixel spacing for slopes. Record cartographic light direction
and any height exaggeration. Do not invent neighboring heights at gaps.
Use an unshaded numeric color legend; do not mistake brightness for elevation.

Choose globe-lighting behavior deliberately with the existing material contract.
Flood curvature, directional Sun shadows and cartographic relief have different
roles. Preserve shared controls; don't blindly stack incompatible shading or
disable all lighting because a map already has relief. Inspect the mounted result
and explain its interpretation. Additional pixels cannot rescue dull relief or
add measurements absent from the source.

## Coverage

Use the dataset's validity mask, alpha or documented no-data values. If a
heuristic is necessary, record its uncertainty and preserve ambiguous observed
pixels. Low brightness alone is not evidence of missing terrain; an exact-black
rule suitable for one product is not a general rule for JPEGs or other sources.

Resolve validity before resampling. Reject incomplete interpolation footprints
at missing boundaries rather than borrowing invalid neighbors. Source mask
values, masked scientific cells and the prepared gap indicator have distinct
roles. Bake the shared neutral gap presentation only into identified gaps;
inspect it alongside valid dark terrain. Do not extrapolate to fill missing
regions or enlarge masks just to make a prettier boundary.
Apply the same coverage treatment to context billboards and navigation markers:
missing imagery must not cut holes in a known body's silhouette. When a flat
map crop needs depth, prepare full-phase curvature against that exact silhouette;
do not add a terminator or assume that already-lit disc photographs need it too.

## Shape and optional layers

Choose the best-supported representation:

1. Use measured geometry or dimensions when available.
2. Otherwise, use an applicable published shape model, retaining its assumptions
   and uncertainty. A model inferred from light curves or thermal observations
   need not be a uniquely measured mesh to be useful.
3. Otherwise, construct an approximation constrained by available observations,
   such as projected outlines or occultations. Separate observed quantities from
   assumed depth, symmetry, size normalization and orientation. Check consistency
   with the constraints; do not present the derived axes as independent measurements.

A mean-radius estimate alone does not establish a spherical shape. If shape is
unconstrained, state that limitation; any generic illustration must be identified
as such and fit the user's intent. Missing an exact mesh is not by itself a reason
to default to a sphere or remove a body. When a representation is challenged,
first investigate a better-supported approximation instead of deleting the work.

Examples of the reasoning, not dimensions to copy to other bodies:

- [Nereid](https://doi.org/10.1093/mnras/stw081): a published light-curve/thermal
  ellipsoid family supports an approximate elongated model; inferred roughness
  does not supply craters or terrain to render.
- [Himalia](https://doi.org/10.1126/science.1079462): projected elongation can
  constrain an approximate ellipsoid with explicitly assumed depth and a separately
  sourced size scale; it does not establish three measured axes or a unique pole.

Keep the approximate status and material assumptions visible beside the body,
using existing body-owned content. Use the normal missing-data grid where texels
are unqualified; a grid does not validate the underlying geometry. Do not invent
surface detail or claim an observational lens. Respect the user's geometry budget
and distinguish simplification from scientific certainty.

For irregular geometry, read [irregular meshes](irregular-meshes.md) before
choosing tessellation or baking per-face assets. It covers radial versus full
mesh support, simplification, native PolyCSS triangles and shape-aware targeting.

Rings and visible atmosphere require their own evidence for geometry and
appearance. A detected exosphere alone does not justify a halo. Preserve source
ring orientation, widths and stated optical assumptions; do not copy another
body's appearance. Use the same generic shell and preparation ownership for
emissive or layered bodies, with only the controls actually supported.

## Registration

Reproduce the reported camera and settings. Temporarily hide a layer to isolate
its contribution, then restore it; a layer's name does not explain an artifact.

- Check source projection and longitude direction against independent landmarks
  or coordinate values. Linear image latitude may not map linearly through a
  projected texture. Inspect both poles/shape extremes and the seam.
- Bind UV preparation to the actual atlas width, height, band layout, gutters
  and pole tile size. Changing HD dimensions does not imply proportional
  padding; a copied default can shift sampling differently on adjacent faces.
  Check the emitted CSS texture addresses against packed texels, including
  samples near shared edges. If only addressing is wrong, rebuild the prepared
  geometry/presentation and reuse the unchanged HD rasters.
- Trace mesh coordinates, transforms and world radius into lighting/occlusion.
  Keep camera framing separate from physical scale; double-scaling a mesh and
  overlay does not fix a perspective mismatch.
- Inspect close/off-center silhouettes, atlas alpha, gutters, frame bounds and
  the sprite's actual disc radius. Perspective can shift the silhouette and
  make it elliptical; an oversized disc clipped by its frame creates strips.
- Check context billboards at a readable size with their labels. Hiding orbit
  lines must not hide the label of a clearly resolved body. Resolved billboards
  need a purpose-sized image, not an enlarged UI icon; center their labels below
  the disc when there is room.
- Distinguish bad registration from geometric facets: a smooth overlay cannot
  exactly follow a coarse polygon silhouette at every rotation. Do not conceal
  this with a halo, blur or invented terrain.

Fix the owning preparation and regenerate affected surface, pole, thumbnail,
minimap or legend assets. Keep a small regression for the demonstrated defect
and reuse its browser views in the [final checks](qualification.md).

### Dense scientific materials on fixed bands

For an existing oriented-band scene, a scientific lens may set an integer `rasterScale` in its preparation recipe. This increases only its prepared surface atlas; polar dimensions, geometry and the runtime canonical-density policy remain fixed. Generate its bounded minimap through the same authored scale. Compare ordinary framing and close zoom before choosing the scale, and report compressed bytes separately from decoded pixels.

Large raw numeric archives use the streaming pinned source downloader and verifier. Keep float validity and units explicit, scan the source before sampling, and reproduce the compact grid into an empty output directory. A hash identifies exact bytes, while the provider label identifies the product and version.
