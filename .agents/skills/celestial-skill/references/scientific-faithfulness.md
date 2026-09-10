# Scientific faithfulness

Use the sections relevant to the changed claims. A small repair does not require
a new all-body audit. Preserve valid evidence and record unresolved interpretation
as unresolved; a failed source lookup is not proof of a defect or of fidelity.

## Trace a view from source to screen

For each affected lens, identify the pinned source product, physical quantity,
units/datum, wavelength, acquisition date or date range, valid coverage, spatial
resolution and transformations. Read the executing recipe, not just its label or
README. Check that legends, thumbnails, minimaps, pole tiles and world markers
describe the same interpretation as the globe.

When a derived image changes, follow its other consumers too: navigation recipes,
per-body marker images and cached information panels can carry separate source
pins. Regenerate those through their owners and verify their bytes; updating only
the body's runtime inventory does not close the source-to-screen chain.

Distinguish observations, calibrated products, enhanced composites, inverse
models and illustrations. In particular:

- A procedural texture made from luminance and latitude is not an instrument
  measurement of temperature or composition. Give an intentional illustration
  a model label and an appropriate nonphysical legend, or remove the unsupported
  view. A mission credit cannot supply provenance for generated values.
- A visible-light gap fill does not measure another wavelength. Do not inject
  photographed structure into missing UV, methane or thermal coverage. Inspect
  polar stabilization, blending, boundary continuation and fallback code as well
  as the initial raster conversion. Neutral invalid coverage must survive the
  whole pipeline. Follow [coverage preparation](surface-preparation.md#coverage).
- Agency-distributed display maps can contain inpainting, monochrome poles or
  artistic color. A gravity-derived crust map is an inferred model, not a direct
  interior observation. State assumptions that materially change interpretation.
  Retain the inversion version and priors when alternative models explain the
  same observations.
- Synoptic mosaics combine observations over time. A global source, an off-limb
  image and orbital positions may have different dates; do not imply a single
  simultaneous photograph or current observation.
- Noise, photometric normalization and unobserved terrain must not be described
  as resolved topography or calibrated albedo. Pixel size is not resolving power.

Keep a view's essential qualification in its visible description. Verify the
actual expanded lens panel, including lenses that have a minimap: a template
conditional can leave accurate descriptions present only in alt text/tooltips.
Use concise, body-owned wording rather than a generic disclaimer on every lens.

## Shape scalars must refer to the displayed surface

For an irregular body's radius or elevation layer, bind the scalar to a defined
point on the full source shape and then to the retained display face. A ray from
the origin may intersect several surface sheets. Selecting the first hit,
silently selecting the outermost hit, or accepting interpolated radial cells can
assign another surface's value to a correctly rendered mesh.

Test concavities, necks, undercuts and shape extremes in addition to ordinary
terrain. Record face identity or equivalent correspondence, source point, source
radius and datum. An outermost radial map can be an explicitly defined flat
preview; it is not proof that each rendered surface received its own scalar.
Withhold ambiguous preview samples where the projection cannot represent them.

Where closest-surface transfer is appropriate, use the full source triangle
surface, a source-unit distance allowance consistent with simplification error,
and explicit treatment of competing surfaces. Nearest vertices and normal-dot
heuristics alone do not establish correspondence. Keep atlas bleed texels tied
to the retained triangle's boundary. Preserve source mesh memory bounds when
processing large inputs; avoid loading duplicate full meshes for validation.

Independently compare source-coordinate anchors against the encoded scalar,
legend and decoded prepared sample. Check sign, units, datum and quantization;
report simplification and transfer error separately from source accuracy. A
smooth color map or a test that calls the same sampler twice cannot prove this.
Radial height above a reference sphere is not gravitational height. Distinguish
the scientific datum, physical mean radius and display reference radius.

## Positions, orientation and clocks

Bind ephemeris comparisons to the exact target, center, frame, epoch, time scale
and units. Verify geometric versus apparent vectors and body center versus
system barycenter. Compare independently sourced vectors at the displayed epoch,
reporting both Cartesian distance and phase/angular error; plausible orbital
radius alone can conceal a badly wrong phase.

Use a model only within its evidenced validity interval and accuracy. Simple
mean elements can drift badly for resonant or co-orbital moons. A short fitted
epoch range is not a valid long-term propagator. If current authoritative data
are unavailable, qualify the extrapolation or withhold unsupported precision;
do not invent a known-correct phase. A pinned single-epoch vector can support a
fixed scene, but must reject other epochs rather than masquerade as propagation.
For a fitted propagator, distinguish fit residuals from independent holdout
checks near both ends of the claimed interval and at the displayed epoch.

Separate attitude from position: synchronous rotation, a measured pole, chaotic
tumbling and an illustrative orientation are different claims. A stable spin
animation does not establish real attitude, particularly for irregular moons.
Label accelerated display rotation as illustrative. Keep scene epoch distinct
from image acquisition dates and do not imply that a fixed orbital scene advances
with an animation clock.

## Factsheets and precision

Prefer source tables and primary publications with field definitions. Record
the field's quantity and uncertainty along with the value: mean versus
equatorial radius, sidereal versus solar period, model-derived versus measured,
geometric versus Bond albedo, and discovery versus announcement year. Resolve
disagreements by semantics before choosing a number. Do not average incompatible
definitions or copy excessive digits from a loosely constrained catalog field.

When deriving a value, retain the formula and its input provenance. Round a
sidereal period calculated from a rotation rate consistently; do not silently
substitute an orbital period unless the synchronous assumption is justified.
Keep uncertainty visible when omission would materially overstate confidence.

## Review evidence and delivery

For a broad requested audit, inventory the actual registry and loaded assets.
Separate bodies with a confirmed defect, bodies with unsupported claims, and
qualified approximations. If agents review independent groups, give each the
same exact checkout and artifact boundary; reconcile their findings and identify
shared preparation causes. Do not count one shared defect as many distinct bugs.

Use source-owned evidence and an independent computation for numerical findings.
Separate fidelity from renderer correctness, visual acceptance and installability.
Write a concrete review with claim, source, observed result, uncertainty, affected
bodies and a bounded correction. Inspect any browser deliverable at its actual
URL and verify its server/artifact lifetime before saying it is available.

For repairs, show how each confirmed finding was resolved or visibly qualified.
Add regression cases for demonstrated mechanisms, not tests of prose or one
declaration per body. Run the relevant [qualification](qualification.md) checks;
do not call unresolved external restoration or failed aggregate checks green.
