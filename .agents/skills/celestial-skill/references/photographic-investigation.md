# Choose a photographic investigation route

Use this when adding or repairing a photographic surface. Read the body's
investigation ledger first and compare the relevant archive products and full
papers before committing to a reconstruction method. Prefer a suitable controlled
product over recreating its producer's work. Keep the task's geometry and renderer
scope fixed; a different source route does not authorize architecture changes.

## Choose by the available product

| Available product | Establish before using it |
| --- | --- |
| Producer photographic map or mosaic | Published projection, body-fixed frame, reference surface, coverage and processing; verify our geographic sampling and any transfer to the selected mesh. |
| Photograph with archived camera controls or per-pixel surface geometry | Exact image/model identities, pixel conventions, quality and surface correspondence. Reuse compatible archived geometry; validate any derived camera with disjoint controls. |
| Unmapped photograph | Recover the image's camera, calibration and body orientation from the release, PDS/SPICE and published controls; verify both limb and interior registration. |
| Photographic map available only as a paper figure | Establish the map's coordinates and reference surface, recover and check the printed grid, and assess usable pixels, digitization uncertainty and reuse terms. A map-like appearance alone establishes none of these. |

These are alternative routes, not successive prerequisites. Camera-fitting checks
apply when a camera is derived or adjusted. They are not required to reuse a
qualified map. All routes still require source identity, supported image-to-surface
placement, valid coverage and an honest account of the displayed quantity.
Use the [implementation map](implementation-map.md#choose-a-photograph-route)
after choosing the route; a missing decoder does not establish missing science.

## Reuse a published map

Read the map label and producer's method together. Establish projection and pixel
origin, longitude direction and prime meridian, latitude definition, axis/frame
conventions, reference shape or radius, map extent and missing-data policy.
Distinguish photographic pixels from painted relief, interpolated fill, annotations
and scientific fields. Preserve the product's stated resolution and uncertainty;
a controlled map is not necessarily an exact map or a reflectance product.

Check geographic-to-pixel conversion against distributed published grid positions
or landmarks, including the seam and latitude extremes where present. A round trip
through our own transform proves only self-consistency. When fitting a transform,
reserve independent positions to check it. Known geographic coordinates do not
by themselves prove transfer to a different shape: follow
[model correspondence](registered-photographic-mosaics.md#match-observations-to-their-shape-model).
Missing original camera files alone do not disqualify a map with adequate producer
registration evidence; unresolved map-frame or shape correspondence still does.

Sample the qualified map at its useful resolution through an existing preparation
route. If sharper original photographs are available, using the map to locate them
requires separately validated image-to-map correspondence. Map coordinates cannot
automatically georeference a sharper replacement image.

## Recover a map or controls from a paper figure

Look for the original mapped raster in the archive, supplements or linked release
first. If the figure is the available source, distinguish two uses: its own
photographic pixels as a surface, or its grid/features as controls for another
image. The second use needs a qualified correspondence to that other image.

Pin the publication/version and record page, figure, extraction method, native
dimensions and crop. Inspect the embedded image when available; rendering the PDF
larger does not create detail. Preserve cited measurements without committing a
publisher PDF merely as evidence; follow the repository's source-retention and
reuse rules for anything consumed by preparation.

Use labeled coordinates and the stated projection to recover the grid. Account
for page rotation, unequal scale or scan distortion where measured. Do not infer
longitude direction, grid spacing or a body pole from an unlabeled line. Resolve
contradictory captions, prose and map conventions using independent source evidence;
keep unresolved alternatives explicit rather than choosing whichever fits best.

Check the fitted grid on distributed positions not used to determine it. Inspect
annotations, compression, halftoning, cropped boundaries and blank regions before
declaring usable photographic coverage. Mask identified non-photographic pixels
before interpolation; do not inpaint labels, recreate obscured terrain or classify
all dark pixels as missing. If the figure only supports coarse detail, preserve
that limit instead of upscaling it into a claim of higher resolution.

## Keep uncertainty attached to what was measured

Report extraction repeatability, control-pick precision, camera residuals and
shape mismatch separately, in their native units. Convert them into image or
surface displacement only with a justified scale. A shape's published RMS limb
departure is not automatically a camera-error distribution or fit weight.
Variation among paper crops or filters measures sensitivity to that extraction;
it is neither the original photograph's absolute error nor a probability bound.

Choose acceptance limits from the source precision and intended surface claim.
Keep controls used for fitting or choosing a model distinct from independent
checks. A point excluded from the objective but used to select weights or a winning
fit is not an untouched holdout. Retain contradictory checks; a low residual or
high correlation alone cannot resolve an ambiguous rotational phase or map frame.
Use the [camera guidance](registered-photographic-mosaics.md#bind-observations-and-validate-cameras)
for camera-specific checks. Do not relax registration to an approximate drape.

## When a method stalls

Before another fit variant, state which unresolved quantity it would constrain
and what result would change the decision. Reassess the source route when fits
remain unstable, depend on arbitrary weights, or leave the same ambiguity.
Compare relevant mapped products, archived controls and representations already
found; do not automatically restart the whole archive search or stop the body task.

Use the existing ledger's findings, evidence and `revisitWhen` fields to record
the method, inputs, result and next discriminating check. Update an existing entry
for the same investigation; retain a separate disposition when an alternative
route has different evidence. Distinguish:

- **Missing source information:** name the frame, control or coverage fact that
  is absent, where it was sought, and what evidence would reopen this route.
- **Missing preparation support:** identify the unsupported product/conversion
  and follow the existing shared-tooling workflow; this is not a source absence.
- **Measured uncertainty or incompatible geometry:** state what placement or
  resolution remains supported, and defer a surface that cannot meet the claim
  within the authorized scope. A label cannot qualify an unsupported photograph.

A camera-fit failure does not reject a separately mapped product. Conversely,
discovering a map does not qualify it. Make a small source-space check of the
remaining route before an expensive bake. Continue useful authorized work, and
describe a blocker at the level the evidence supports. Research diagnostics and
ledger updates do not complete a requested photographic surface.
