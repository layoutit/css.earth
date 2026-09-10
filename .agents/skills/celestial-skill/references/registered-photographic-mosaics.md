# Registered photographic mosaics

Use this when preparing several observations onto a known surface, especially
an irregular mesh. Reuse already-controlled maps when suitable; this is not a
requirement to fit a camera for an existing global mosaic. The
[implementation map](implementation-map.md#registered-photographic-mosaics)
locates the 67P example and reusable helpers. Keep all decoding, camera fitting,
selection, level matching and atlas construction in preparation.

## Match observations to their shape model

Check the model version, coordinate origin, axes, longitude convention and
rotation assumptions behind the observation geometry. The same body name or
author does not establish compatibility between a paper, an archived mesh and
an image's camera solution. A newer shape is not automatically a better host
for imagery registered to an older one.

When task scope allows it, a dataset may retain its matching source-backed mesh
alongside other datasets' models. Use the existing prepared-model selection;
do not add a renderer or force every dataset onto the body's default mesh.
Transfer imagery between models only with a qualified correspondence. Keep
camera controls, visibility checks, gap masks and coverage denominators tied
to the actual selected model. Report coverage on different meshes separately;
compare before/after percentages only on a common, justified surface basis.

## Bind observations and validate cameras

Record each observation's pinned bytes, calibration level, units, filter,
acquisition time, pixel conventions, body frame and geometry's shape-model
identity. Different epochs or bands need an explicit interpretation before
compositing; a mosaic does not represent a single simultaneous observation.

Bind quality companions to the exact observation and pixel layout before using
their flags. Check documented flag polarity, no-data and compression semantics.
Where product levels promise identical radiance, compare every radiance sample
as well as identity metadata; do not impose equality on differently calibrated
products. Acceptance of lossy imagery needs an explicit, source-specific policy.

Use an archived camera model or a fit supported by the product's geometric
metadata. For corrected XYZ/pixel products compatible with a projective camera,
fit from spatially distributed correspondences, then validate on disjoint
coordinates withheld from fitting. Report fit/holdout counts, RMS and maximum
residuals in source pixels, plus invalid projections. Choose tolerances from
source precision and the output's needs; reject degenerate or unexplained fits.
Do not infer a precise camera from a caption or sub-spacecraft longitude alone.
A holdout from the same GEO product proves internal consistency, not independent
absolute accuracy or agreement with a different display mesh.

## Qualify a surface sample before interpolation

Keep camera fit, correspondence between shape models, detector quality and
visibility as separate checks. For geometry-backed images transferred to a
simplified mesh, the 67P route illustrates these checks:

- Locate a corresponding point on the full source mesh within a justified
  physical distance of the displayed surface.
- Project with the observation's camera. Require valid geometry and accepted
  quality for every interpolation contributor, with all contributors close to
  the same surface patch. Checking only the averaged XYZ can mix foreground and
  background at a neck or limb even when every pixel is individually valid.
- Check visibility from the acquisition camera against the full source mesh.
  A positive depth or front-facing normal alone does not establish visibility
  on a concave body. Tie intersection tolerances to scale and source uncertainty.
- Withhold samples outside the supported incidence/emission and correction-gain
  limits; record rejection reasons. Derive the limits from this source and mesh.

Finite zero or negative calibrated radiance can be valid. Brightness is not a
quality mask, and presentation contrast must not change eligibility. If no
observation qualifies, retain the prepared gap. Do not relax geometric limits
solely to improve the coverage number or paint the unseen side.

## Normalize, select and match levels

Follow [photographic observations](surface-preparation.md#photographic-observations)
for appropriate correction of linear radiance before resampling and display
encoding. In 67P, each contributing source pixel is divided by the
Lommel-Seeliger disk term `D = 2 cos(i) / (cos(i) + cos(e))`, with incidence
angle `i` and emission angle `e`, before interpolation.
This is a dataset-specific approximation with bounded gain, not a default for
all bodies. It does not recover albedo, cast-shadow detail or omitted phase and
roughness effects.

For compatible observations, select among qualified samples with a recorded
geometric criterion and deterministic ties. 67P minimizes the largest emission
angle among each candidate's interpolation contributors, favoring less
foreshortening. Brightness does not choose the winner. Different resolution or
source uncertainty may justify a different criterion; retain its rationale.

When residual exposure steps warrant level matching, sample the same surface
locations in each observation after photometric correction. Robust median
log-ratios and their dispersion can constrain one relative display gain per
observation. Withhold sparse or inconsistent overlap pairs, anchor the reference
scale, and require accepted overlaps to connect the images being fitted. Reject
unsupported or excessive gains rather than silently clamping a failed fit or
inventing calibration for a disconnected image. These are display adjustments;
inspect multiple boundaries for remaining registration or physical differences.
Positive samples are necessary for log-ratios only; excluding nonpositive values
from the fit must not erase valid dark pixels from the mosaic. Keep the common
display stretch and its reference explicit.

## Preserve attribution and measure coverage

For winner selection, prepare a lossless observation-index raster aligned with
the atlas: a gap code plus stable observation IDs bound to pinned source hashes.
Record dimensions, encoding, decoded length, hash and gutter/bleed treatment.
Check the decoded codes and their counts against the preparation report. If a
method instead blends sources, retain contributors and weights; a single winner
index cannot describe the result. Keep this audit data outside runtime delivery
unless an authorized product feature consumes it.

Count atlas-interior texels separately from bleed and padding. For a claim about
surface coverage, weight accepted samples by physical surface area. One reusable
estimate samples deterministic stratified barycentric points per triangle and
sums triangle area times the accepted fraction, then divides by total mesh area.
Report the sampling density,
mesh identity, acceptance policy and denominator, using the same locations for
before/after estimates. Qualify it as a sampled estimate of that mesh, not an
exact fraction of the real body. A precise percentage is not evidence of equally
precise accuracy; increase sampling if a decision depends on that precision.

## Qualify the result

Use the relevant [qualification checks](qualification.md). Exercise changed
behavior with independent geometric cases and source anchors: displaced or
occluded patches, interpolation across a discontinuity, valid darkness,
selection ties, disconnected overlaps, excessive gains and attribution decoding
where applicable. Reuse existing tests rather than duplicating the pipeline as
an expected-value oracle.

Inspect source images and multiple mounted views, including newly covered areas,
necks/limbs, seams and both supported lighting states. Bind before/current
captures to the actual loaded image hashes and matched camera, geometry,
viewport, DPR and settings before making an absolute diff. An atlas comparison
in the same renderer is not native-renderer parity. Preserve the established
mesh budget for imagery-only work; verify retained identity and canonical banks
at DPR 1 and 2. Reuse valid source-restoration and delivery evidence, extending
it for newly required inputs and changed runtime assets.
