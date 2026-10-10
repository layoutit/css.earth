# Scientific faithfulness

Use the sections relevant to the changed claims. A small repair does not require
a new all-body audit. Preserve valid evidence and record unresolved interpretation
as unresolved; a failed source lookup is not proof of a defect or of fidelity.

## Trace a view from source to screen

For each affected dataset, identify the pinned source product, physical quantity,
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
actual expanded dataset panel, including datasets that have a minimap: a template
conditional can leave accurate descriptions present only in alt text/tooltips.

For spectral cubes, retain the observation, wavelength and geometry companions
as one input set. Select channels by each pixel's calibrated wavelengths, reject
archive special values, and pool spectra before forming ratios. Use the paper's
actual estimator, including its continuum windows and averaging order; a band
depth, a contrast ratio and a modeled abundance are different quantities. An
independent reader should check native samples and the derived arithmetic.
Preserve the native spatial resolution when choosing averaging and output size;
resampled pixels do not become independent measurements. Register accepted
footprints through the companion coordinates and leave gaps unavailable.

Charon's `source/science/leisa/bands.json` is the worked LEISA example. Its
`spectral-band-maps` acquisition operator produces numeric GeoTIFFs for the
existing scientific-raster interpreter. A surface's fractional `resolutionScale`
can keep coarse science out of photograph-sized atlases when the scaled packing
dimensions remain integral. This changes image preparation, not the mesh.
Check actual leaf backgrounds after selection: a changed sidebar, minimap or
`data-dataset` alone does not prove that the body changed its texture.
Use concise, body-owned wording rather than a generic disclaimer on every dataset.

For released longitude/latitude composition grids, the `mapped-composition`
acquisition operator converts pinned King et al. SPHERE JSON releases into the
same numeric GeoTIFF input. Europa and Ganymede's `source/composition/` recipes
are worked examples. Verify the actual coordinate arrays, missing-value marker,
selected wavelengths and posterior field names before conversion. Retain
released uncertainty endpoints; adding component medians or their bounds does
not recover the posterior of a sum. Prefer an author's released total when one
exists. A fitted grain-size component is neither total ice nor a direct grain
measurement. Keep model fractions distinct from measured spectral ratios.

Preserve the native grid nodes when reordering longitude or latitude. A periodic
seam duplicate repeats an existing sample; it cannot add coverage. Compare
source and converted values at their geographic coordinates, including gaps,
zero, both hemispheres and the seam. State the instrument's resolving power
separately from its resampled grid spacing. If a fit's header conflicts with the
paper's observation dates, inspect released masks and preserve the discrepancy;
footprint agreement alone does not establish every cell's acquisition time.

## Published simulations

A simulation is a source when it was computed for the named object, a paper
describes it, and its output is released under terms that allow reuse. Look for
one during the source survey, also where nothing is measured: a planet without a
measured map need not stay a neutral sphere.

- Show it as a dataset of its own. Its visible description names the model, the
  paper and the scenario the run assumes: the atmosphere, surface and rotation it
  was given. When nobody has detected that atmosphere, say so.
- A planet opens on the best dataset it has: a measured map or image first, then a
  published simulation, then one measured color over the whole body, then an
  estimated one, and the neutral shape last. So a simulation is the default view where nothing measured is drawn as a
  map, and it says it is a model there as plainly as anywhere. Never blend simulated
  structure into a measured dataset, and never use it to fill a gap in one.
- Use the released numbers: the quantity, units, grid and time averaging the
  release states, with a legend in those units. A temperature map in false color
  is not what an eye would see.
- A time mean is the one the release wrote. A file of instants gives one instant,
  and the dataset says which. Pick the quantity that carries the pattern: under
  ten bars of steam the surface temperature is uniform to a few kelvin, while the
  outgoing radiation holds the day and night contrast.
- Do not show a scenario that a measurement of the object contradicts, such as a
  thick atmosphere on a planet whose measured dayside is as hot as bare rock.
  Where a measurement leaves the scenario open, say what it found.
- When several models of the same case are published, show one and name it, and
  state how far the others differ. Do not average models.
- Draw only what is visible at the size the body is shown. A pattern that spans
  the body qualifies: the day and night sides of a tidally locked planet, or the
  few convection cells of a red supergiant. Structure smaller than a pixel, such
  as granulation on a Sun-like star, is not painted larger.
- A model of a class of objects is not a model of this object. A generic emulator,
  an author-drawn impression and a procedural texture stay out.
- A measured dataset outranks a simulation of the same quantity. Keep both when
  the comparison is the point.

[WASP-103b](../../../../src/objects/wasp-103b/README.md) is the worked example: one
published climate simulation, read from the authors' numeric table, with the
paper's assumptions and its known mismatch with the observations stated beside it.

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

An orbit whose plane no source measures is not drawn as if it were measured. When a hosted orbit takes its tilt and node
from a stated assumption, its record carries `placement: approximate` and says in `sources.placement` what is assumed, whose
measurement it borrows, the published test of that assumption and which elements are measured (a generator spec's
`orbit.assumedPlane`). The page then draws the path dashed and names the body "(approx)", as it does a moon whose published
orbit is not unique (Dactyl, Selam). 55 Cnc b, c and f take the plane measured for 55 Cnc d this way, and Proxima Centauri b and d the star's equatorial plane, from its measured rotation axis.

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

## A scene needs a measured shape

A page shows a body up close, so its outline is a claim. Give a body a scene only when
someone measured its shape: resolved images, a published shape model, or measured axes.
A size computed from an assumed albedo, a minimum elongation from a light curve, or a
nominal radius is a fact for a card, not a shape. A body with only those stays a named
dot in its host's bank of moons without a page, and is not drawn as a sphere or an
ellipsoid of assumed depth and orientation. Saturn's irregular moons follow this: Ymir
and Siarnaq have published light-curve shape models and keep their pages; twenty with
only an elongation limit, and Anthe, are dots ([moon lists](../../../../docs/moon-catalogues.md)).

### A light-curve shape alone is not a page

A convex shape fitted only to how an asteroid's brightness changes as it spins is a
published shape model, but a page that offers nothing else shows a gray blob and its
own heights. Give such an asteroid a page only when there is more to visit: it is a
spacecraft target, a resolved image or a measured surface is shown on it, or it lies
outside the populations of the [asteroid dot bank](../../../../src/objects/catalogue-asteroids/README.md)
and would otherwise leave the map. The rest are dots of that bank, which are not named
and not clickable. On 2026-10-06 this retired 185 pages; Braille, Eurybates and Orus
(spacecraft targets), Athamantis (a resolved image) and 18 asteroids outside the
populations kept theirs. Models that add resolved images or occultations to the light
curves, and shapes from radar or spacecraft, are not affected.

A measured color is something more to visit. An asteroid at least 100 km across in the JPL
Small-Body Database, with a light-curve shape in DAMIT, a Gaia DR3 reflectance spectrum and a
measured albedo, has a page that shows the shape in that color at that brightness. On 2026-10-08
this brought back 54 of the retired pages in color and added 44 asteroids
([asteroid colors](../../../../packages/bake/authoring/asteroid-colors/author.mts)). An asteroid
with no published shape gets no page: it is never drawn as a sphere.

A nebula's photograph follows the same rule. A page turns the camera around its subject, so
the picture needs a depth someone measured: walls from spectra, a published surface or density
grid, or measured points. A photograph standing as one flat picture at the nebula's distance
is a line from the side, not a scene. Six Messier nebulae had only that and have no page
([Messier guide](../../../../docs/messier/README.md#left-out)).

A galaxy's, a cluster's or a far object's photograph follows it too. A picture standing flat at
the object's distance, facing the Sun, is where a picture of the sky lies, not a shape. A disc
galaxy's picture lies on its measured disc; an elliptical's light fills a published profile; a
cluster keeps its page where papers give its gas and mass a shape (the Bullet Cluster,
MACS J0025, El Gordo, Abell 1689). Twenty-six pages had only the picture facing the Sun and
were retired on 2026-10-06: eleven Messier galaxies (same guide); the clusters Abell 370,
Abell 2744, Abell S1063, MACS J0416, MACS J0717, MACS J1149 and SMACS 0723, whose member dots
had an assumed depth; and the Cartwheel Galaxy, Stephan's Quintet, Earendel, the Einstein
Cross, JADES-GS-z14-0, MoM-z14, 3C 273 and TON 618. A bulge volume or dots of assumed depth
around such a picture do not make it a scene.

## Estimates

An estimate is a number nobody measured for this object: an equilibrium temperature
computed from an orbit, not a brightness seen in an eclipse.

- Show one only when a published sample tests it. State the test where the estimate
  is shown: how many objects, and how far the measured values fall from the estimate.
- Show it only for objects like the ones tested. An estimate tested on hot giants
  says nothing about a small planet.
- Call it an estimate in its name, its legend and its description, never "measured"
  or "observed". The number itself is still one a paper prints.
- It ranks below every measurement, and a measurement replaces it.
- A structure this repository derives from a measured map by a published method is an estimate too: a star's corona
  from its magnetic map ([the method and its two tests](../../../../docs/stellar-corona-from-magnetic-maps.md)). Its name
  says "derived", its description says it is neither observed nor published and names which of its inputs are measured,
  and it is refused for a star the method does not hold for. A published simulation of the same star ranks above it.
