# cssEarth implementation map

Paths are relative to the selected repository. The documentation links were
checked against main `2f6f8614add9a5a22ef03b86a47edef631950ade` on 2026-09-09.
Code examples below name the revisions where they were checked. Inspect the
current checkout before using them.

## Start from authored data

Current celestial packages live under `src/objects/<id>/`, including moons and
dwarf planets. Their `object.json` supplies a `properties.recipe` with pinned
source references and supported capabilities. Shared preparation produces the
renderer payload. Do not scaffold a private runtime, preparation script suite,
or shell for each new body.

```text
src/objects/<id>/
  object.json                         authored recipe and prepared reference
  README.md                           sources, processing, evidence and known problems
  NOTICE.md                           credits and reuse terms
  source/manifest.json                 exact source closure
  source/preparation/*.json            acquisition and capability inputs
  source/content/object.json          content and supported controls
  source/presentation/                title and applicable map inputs
  prepared/                           generated runtime/content/controls/object JSON
  prepared/page.json                  generated page assets and controls
  runtime-assets.json                 generated image inventory and hashes

public/scenes/<id>/                    prepared assets
site/pages/[id].astro                  one shared route for all body ids
tests/objects/unit/<id>/               focused hand-written body tests
tests/objects/unit/anchors/*.json      per-body anchors for the shared contract runners (asteroid calibration, asteroid packages)
tests/objects/browser/<id>/browser-profile.mts
```

The [documentation contract](../../../../docs/provenance/CONTRACT.md) explains
where body docs and evidence go. Every file under `source/` needs a manifest
entry. Keep test logs and browser screenshots outside it.

Use `tools/object-package-contract.mts` for actual required files. Its authored
branch is selected through `tools/authored-object.mts`; the legacy branch still
mentions `runtime/client.mjs`, package Astro pages, and per-body tools. Those
fallback requirements are not the current authored-package template.

## Find the owner for the change

| Change | Source owners |
| --- | --- |
| Identity, route, lazy loading | Body `object.json` → `tools/prepare-catalog.mts` → `site/objects.mts`; `site/object-adapter.mts`, `site/packaged-object-runtime.mts` |
| Physical data, orbit records and acquisition choices | `packages/astronomy/data/bodies/<id>.json`, `packages/astronomy/tools/body-records.mts` |
| Authored and prepared object contracts | `packages/objects/src/descriptor.ts`, `packages/objects/src/authored.ts`, `src/renderers/css/validation/` |
| Preparation dispatch and publication | `tools/objects/prepare-authored.ts`, `tools/objects/publication.mts`, `tools/prepare-object-json.mts` |
| Source acquisition, verification and runtime inventory | `tools/objects/operations.ts`, `tools/objects/operations-acquisition.ts`, package source manifests and acquisition JSON |
| Retained scene, selection, resources and lifecycle | `src/renderers/css/runtime/object-runtime.ts`, `src/renderers/css/rendering/`, `site/scene-contract.mts`, `site/scene-router.mts` |
| Shared input, world camera and physical registration | `site/runtime-policy.mts`, `src/renderers/css/navigation/`, `src/renderers/css/rendering/prepared-camera-runtime.ts`, `tools/objects/world-navigation.ts` |
| Shared page and content presentation | `site/pages/[id].astro`, `site/components/ObjectPage.astro`, `site/object-page-data.mts`, `site/object-page-contract.mts`, `site/layouts/PlanetLayout.astro` |
| Content, lens labels, title and minimap preparation | `tools/objects/content/`, `site/prepare-lens-labels.mts`, `tools/prepare-planet-title-sources.mts`, `tools/prepare-surface-minimaps.mts` |
| Search and marker presentation | `site/planet-search-objects.mts`, `tools/prepare-navigation.mts`, `src/navigation/marker-presentation.mts` |
| Open hyperbolic trajectories | `packages/astronomy/src/kepler.ts`, `src/platform/prepare-hyperbolic-path.mts`, shared world-context preparation and orbit validation/projector |

Minimap preparation accepts authored source paths and prepared source records.
For a prepared surface, `map.url` identifies the preview image; its `source`
object records provenance and must not be treated as a file path. The parser
lives in `tools/surface-preview-source.mts`.

For an unbound body, use the shared prepared hyperbolic path with explicit open
endpoints and an epoch vertex. Do not wrap its anomaly, close its last edge or
invent a revolution period. The finite display window is not a physical bound
or a propagation-accuracy claim. See [open trajectories](../../../../docs/prepared-navigation-ownership.md#open-trajectories).

Follow the selected preparation branch into its reusable implementation under
`tools/objects/`. Preparation owns geometry, source interpretation, atlases,
lighting and other scene assets; the shared CSS renderer consumes prepared data.
Body facts stay in the package. Extend a shared capability only when the source
requires behavior the existing capability cannot express.

`site/pages/[id].astro` derives routes from `OBJECTS` and passes the selected id
to `ObjectPage.astro`. That component loads the body's prepared page and content,
applies its declared stylesheets, and uses the shared head/panel and `PlanetLayout`.
`site/objects.mts` loads descriptors through `loadPackagedObject`. Preserve one
registry, generic adapter, shared shell and active object scene; navigation uses
the shared world camera.

Navigation marker appearance comes from each authored package's
`source/preparation/navigation.json`, which names its source image by path;
the pins and attribution are the source manifest's record. `tools/prepare-navigation.mts` generates
individual `public/navigation/body-<id>.webp` images and their 2x counterparts.
Builds assemble the ignored `site/prepared-navigation-markers.mjs` from those
images and recipes; `PlanetNavigationMarker.astro` consumes it. Follow the
[registration steps](../../../../src/objects/README.md#register-a-body-without-editing-shared-lists)
instead of editing a shared list or atlas position.

## Choose examples by source needs

- **Different meshes for different datasets:**
  `geometry.radialTerrainAlternatives` binds each alternative profile to a
  `lensId`. `tools/objects/terrestrial-layers/radial-models.mts` loads the models
  at a common physical scale; `solid-scene.mts` prepares selection and picking
  ranges in one retained scene. Borrelly (`comet-19p`) and Tuttle (`comet-8p`)
  use this path. Verify only the selected model is visible and pickable, camera
  behavior remains shared, and the combined prepared asset bank meets the budget.
- **Observation mosaics:** Triton's `source/preparation/terrestrial.json` uses
  the shared `tools/objects/terrestrial-layers/` path for native image geometry,
  photometric correction, compositing and gaps. Reuse the capability with the
  target body's inputs and conventions.
- **Photometric normalization:** `tools/photometry/` evaluates published
  photometric models, including Hapke with macroscopic roughness, for the
  surface-observation and shape-camera routes. Lutetia's
  `source/photometry/` record and its manifest binding are the worked example;
  `tools/photometry/isis.oracle.test.mts` holds the library to the values ISIS
  prints.
- **Elevation relief:** Ceres's `source/preparation/terrestrial.json` supplies
  its height datum, validity limits and cartographic lighting to
  `tools/objects/terrestrial-layers/scientific-raster.mts`. These values and gap
  rules belong to its dataset.
- **Spectral absorption maps:** Charon's `source/science/leisa/bands.json`
  pairs LEISA spectra with wavelength and geometry cubes.
  `tools/objects/observation/spectral-band-maps.mts` prepares footprint-limited
  numeric maps; `tools/oracles/fits/charon-leisa.py` independently checks the
  native samples and arithmetic. Follow the spectral guidance in
  [scientific faithfulness](scientific-faithfulness.md).
- **A sourced shape model:** Haumea's `source/preparation/shape-model.json` uses
  `tools/objects/shape-model/`, with one entry per lens in its `surfaces` list. Inspect both the authored schema and that
  preparer's actual shape support before choosing it for another body; verify
  camera picking in the shared renderer if the new geometry requires it.
- **Published ellipsoids and unresolved outlines:**
  `tools/objects/source-authoring/distant-worlds/README.md` documents the existing
  analytical radius-table extraction. Its helpers accept a selected input file;
  `tools/objects/source-authoring/outer-worlds/inputs.json` supplies the later
  occultation and thermal examples.
  Keep a projected ellipse distinct from a 3D shape, disclose any assumed depth,
  and use the normal unmapped grid. A short title must match the content display
  name; a longer designation can remain in the shared registry for search.
- **Measured irregular radial terrain:** Vesta's
  `source/preparation/terrestrial.json` selects `geometry.radialTerrain`, native
  `primitive: "u"`, and optional meshoptimizer simplification. Read
  [irregular meshes](irregular-meshes.md) before using this branch. The owners
  below were verified in Vesta PR #24 at `1979293e` on 2026-09-07; inspect the
  selected checkout for availability rather than assuming that revision is merged.

| Irregular-mesh capability | Owner relative to the repository |
| --- | --- |
| Source sampling, native triangle planning and per-texel lighting bake | `tools/objects/terrestrial-layers/radial-terrain.mts` |
| Position welding, compaction, meshoptimizer simplification and topology checks | `tools/objects/terrestrial-layers/radial-meshoptimizer.mts` |
| PDS radius values / OBJ radial intersections | `tools/objects/terrestrial-layers/pds-scalar-grid.mts`, `tools/objects/terrestrial-layers/obj-shape.mts` |
| Geometry regressions and independent body anchors | `tools/objects/terrestrial-layers/radial-meshoptimizer.test.mts`, `tools/objects/terrestrial-layers/radial-terrain.test.mts`, `tests/objects/unit/vesta/source.test.mts` |

The OBJ sampler supplies radius by ray intersection; this route resamples the
shape and does not retain arbitrary OBJ connectivity or UVs. It is not proof of
a general full-mesh rendering capability.

These examples identify implementations to inspect, not universal visual or
scientific templates. See [qualification](qualification.md) for source and
browser comparisons relevant to the actual feature.

## Choose a photograph route

Start with the [photographic investigation route](photographic-investigation.md):
an existing map need not pass through camera reconstruction. For supported
cylindrical photographic maps, `tools/objects/terrestrial-layers/native-photograph-source.mts`
reads the pinned raster with its declared grid and validity policy;
`native-photograph.mts` samples it onto existing triangle-atlas rectangles.
`radial-terrain.mts` selects this path through an observation's
`nativePhotographicSampling`. Inspect its source-schema and configuration guards:
it does not accept arbitrary projections, recover a paper figure's registration
or establish compatibility with another shape. Source and atlas checks live in
`native-photograph-source.test.mts` and `native-photograph.test.mts` beside those
owners. These paths were inspected at main `943179c7c748c4e9727b9d94e15b214c2d20a68c`.

For individual observations, each row below gives the recipe format, an example,
what the body owner writes, and the reader oracle. For a demonstrated missing
decoder, route or kernel bank, implement shared support when authorized, even if
this is its first body. Keep product data in the body and executable code in the
shared owner. When that work is outside scope, record the missing stage; the
[archive-product issue template](../../../../.github/ISSUE_TEMPLATE/archive-product.md)
supports a requested handoff, not an automatic stop for authorized implementation.

| The archive ships | Recipe format | Example | The body owner writes | Reader oracle |
| --- | --- | --- | --- | --- |
| A PDS4 cube with per-pixel geometry planes | `pds4-geometry-cube` | Dimorphos `draco` | The `cube` block naming the label planes, transfer limits, photometry | `pds4-geometry-cube.oracle.test.mts` |
| OSIRIS level-5 geometry companions | `osiris-geo` | 67P `osiris` | Frame pins, quality policy, transfer limits, photometry, level matching | `osiris-geo.oracle.test.mts` |
| OSIRIS level-4 reflectance with a solved camera | `osiris-camera` | Lutetia and Steins `osiris` | Camera JSON, optional limb refinement, photometry | `archived-camera.oracle.test.mts` |
| AMICA Gaskell DDR cubes | `amica-gaskell` | Itokawa `amica` | Image, label, original and flat-field pins | `amica-geo.oracle.test.mts` |
| L'LORRI images with TAN-SIP distortion | `llorri-camera` | Donaldjohanson `llorri` | Camera pins | `llorri-geo.oracle.test.mts` |
| New Horizons LORRI calibrated FITS, uncertainty and quality HDUs | `nh-lorri-camera` | Arrokoth `lorri` | Camera pins with a qualified attitude for the exact mesh; native TAN-SIP WCS | `new-horizons-geo.test.mts` (Astropy pixels and WCS) |
| Arrokoth CA05 registered four-band MVIC cube | `nh-mvic-camera` | Arrokoth `mvic` | Image-space registration to its contemporaneous LORRI camera; its native PDS label confirms the bands and data-number quantity, and the recipe declares one `displayRange` | `new-horizons-geo.test.mts` (Astropy pixels) |
| Images with SPICE kernels and no geometry | `spice-camera` | Tethys `iss`: a Cassini ISS VICAR image with its PDS3 label | The `spice` block: kernel bank and kernels in load order, bodies, body-fixed frame, instrument, clock keywords, pixel axes; limb refinement | `tools/spice/oracle.test.mts` |
| A push-frame colour image from a spinning spacecraft, with SPICE kernels and no geometry | `junocam-camera` | The four JunoCam images of Europa (29 September 2022), measured in the [JunoCam guide](../../../../docs/junocam.md) | Frame and label pins; the `spice` block naming the kernel bank, kernels in load order, bodies, the label's target name and the body frame; `epochRefinement` budgets for the two epochs fitted to the lit limb; retained illumination or a disk function; a `displayRange` from 0 | `junocam.test.mts` (the instrument kernel's own field-of-view vectors), `strip-refinement.test.mts` (known epochs recovered from a synthetic spinning camera), `tools/spice/camera.test.mts` |
| Encounter FITS frames with a control network | `encounter-fits` | Wild 2 `navcam`, Tempel 1, Hartley 2 | Frame, label and control pins, level matching | `encounter-fits.oracle.test.mts` |
| Published camera controls for a shape model, or the Galileo SSI image catalog | `controlled-shape-camera` | Ida and Gaspra `calibrated`, and 20 other small bodies | Frame pins with the control network's camera fields or a `cameraCatalog`, photometry, transfer limits, level matching | None yet; preparation refuses a frame whose camera puts more than a quarter of its lit shape on sky |
| A camera lens whose named reference may turn or tilt it | `refinement` on the lens recipe, applied in `surface-observations/index.mts` through `cameras.mts` `turnedCamera` and `tiltedCamera`, kept only if re-measurement improves what it came from | Psyche `zimpol`: a 5° tilt kept | The stage measures, the named reference's decisive median turns every camera once when no other decisive reference disagrees, and the turned lens is measured again; every backplane camera now carries a Sun fitted from the archive's phase plane | `cameras.test.mts` (Sun fit to 0.01°, refused when no single Sun explains the plane, turned camera), `registration.test.mts` (agreement rule), `tests/objects/unit/itokawa/amica.test.mts` (fitted Sun against the SUM file's SZ) |
| Registration of any camera route against the surface | registration stage in `surface-observations/registration.mts` | every camera lens; Tethys `iss` names its `normal` map as the reference | Silhouette residual with its noise floor and the reference sweep (map or the lens's other frames) reported under `registration` in the lens report and written into the body README by `tools/objects/report-registration.mts`; `tools/objects/registration-stage.mts` re-measures a body without re-preparing it | `registration.test.mts` (synthetic elongated body: right and wrong pole, partial disc, frames as reference), `report-registration.test.mts` (README block equals the prepared report) |
| Ground-based telescope frames with no archived geometry | `controlled-shape-camera` with `fits-zimpol-intensity` | Sylvia `zimpol`: deconvolved VLT/SPHERE/ZIMPOL frames | Frame pins with cameras computed by `observer-camera.mts` from a rotation model, Horizons geometry and each frame's header, all named in `source/preparation/observer-cameras.json` and written into the recipe by `tools/objects/observer-cameras.mts` (exposure-midpoint epoch, limb-fitted centre); the mesh the rotation model describes, as a `radialTerrainAlternatives` entry. The model is the release's spin record (`spinOrientation`), read in the column order its published pole supports (`spin-record-reading.mts`), or, for a body a text PCK describes, its IAU pole model (`pckOrientation` over the shared `pck00011.tpc` and a leap-second kernel). `tools/objects/sphere-horizons.mts` writes and pins the two Horizons tables. The lens ships on its paper's comparison figure: `preparation/published-comparison.json` names the figure in the pinned paper, `tools/objects/published-comparison.mts` measures it into `evidence/published-comparison.json`, and `publishedComparison.ledgerEntry` names the included ledger entry; the registration verdict is reported, not a gate. [SPHERE survey photographs](sphere-survey-photographs.md) is the recipe: `tools/objects/sphere-survey/setup.mts` builds and measures the lens in scratch and `install.mts` writes it into the package | `observer-camera.test.mts`: the spin record against the IAU elements DAMIT publishes for the same model, the PCK model against Horizons sub-observer points for Jupiter and Saturn, and the two providers against each other for Pallas; `observer-cameras.test.mts`: every recipe states what its pinned inputs derive; `spin-record-reading.test.mts`: every released spin record reads one way against its published pole, apart from two disagreements the ledgers record; `published-comparison.test.mts`: bands, panels, arrows and the overlap measure on synthetic figures; `sphere-horizons.test.mts`: batching, row checks and pins; `sphere-survey/*.test.mts`: frame selection, listing names, label reading on the survey figures, the lens settings every survey lens shares, and README blocks read from the evidence; `report-registration.test.mts`: a lens that ships on its comparison has evidence matching its record and an included ledger entry citing the paper; `tests/objects/unit/vesta/sphere-registration.test.mts`: the route against the Dawn mosaic through `registration-sweeps.mts` (peak +0.5° over 30 frames, mirrors beaten, the IAU prime meridian 210° away) |
| Three filters with controlled cameras | `controlled-shape-color` | Proteus and Hyperion `filter-color` | `bands` naming the three filters, and `frames` as band sets naming each set's red, green and blue photographs. Native filters/units and the shared color-display policy are required. No single-filter photometric model | None yet |
| ISIS2 orthographic image cubes | `isis2-orthographic` | Borrelly `micas` | Cube pins; no Sun geometry, so no photometry | `isis2-qube.oracle.test.mts` |
| Optical-interferometric visibilities with no image at all | `controlled-shape-camera` with `fits-oi-reconstruction`, on the planet route through the raster science kind `surface-observation` (`science.shape` names the reference sphere table, `science.lens` the lens) | Betelgeuse `matisse`: public VLT/MATISSE OIFITS merged by `tools/objects/interferometry/matisse-continuum.mts` and reconstructed with the public SQUEEZE code at a pinned commit | The merged OIFITS, the reconstructed image and the SQUEEZE build and command as pinned inputs; a `reconstruction` block on the frame naming the visibilities' epoch, band and file; the computed camera | `tests/objects/unit/betelgeuse/reconstruction.test.mts` recomputes the fit of the image to the visibilities with `tools/objects/interferometry/image-fit.mts` |
| A star whose authors deposited their reconstructed image | the `surface-observation` science kind with `fits-oi-reconstruction` frames pointing at the deposited FITS (CDS), one lens per epoch with its own consumer group; nothing reconstructed here | CE Tauri `pionier-2016-11`, `pionier-2016-12` (Montargès et al. 2018, CDS J/A+A/614/A12) | `tests/objects/unit/ce-tauri/reconstruction.test.mts` fits each image to the public OiDB visibilities with `tools/objects/interferometry/oifits-concat.mts` and pins its orientation | The public OiDB level-2 files are an automated calibration, so the fit proves epoch and orientation, not the authors' chi-squared |
| A placed star with only its shape | `neutral-shape` science kind on the emissive route (the interpreter returns transparent plates); `discoveryVisibility` hides a star without imagery from the map | Antares `shape` | `tests/objects/unit/antares/source.test.mts`, `site/test/object-discovery.test.mts`; the ledger records the excluded image routes | The page opens from search; the star joins the map when an image can be cast |
| A published longitude/latitude grid of a surface property in another body frame | `npy-lonlat-grid` scientific format (`terrestrial-layers/npy-lonlat-grid.mts`): the release's `.npy` arrays unchanged, nearest-node cells, and a `frameTransfer` record naming the grid's published spin state and the mesh's spin file; `additionalLensIds` lets the lenses share an alternative mesh | Psyche `thermal-inertia`, `dielectric-constant` (Cambioni et al. 2022 ALMA maps on the ADAM mesh) | `tests/objects/unit/psyche/alma-frame.test.mts` reproduces the authors' sub-observer longitudes and registers the release altitude map by shape; `npy-lonlat-grid.oracle.test.mts` against numpy |
| An unresolved body with published whole-disc colours and albedo | `disc-integrated-color` science kind on the raster route: cited colour record plus CIE 1931 and D65 tables, painted uniformly; discovery does not count it as imagery | Makemake `color`, Eris `color`; Haumea `color` on the shape-model route (`surfaces` list in `shape-model.json`) | `tools/objects/observation/disc-integrated-color.test.mts`, `site/test/object-discovery.test.mts`, `tests/objects/unit/haumea/shape.test.mts` |
| A published illustrative model texture for a body with no imagery | `glb-base-color` science kind (`tools/objects/shape-model/glb-surface.mts`): the pinned GLB's base-colour texture carried through its own UVs; the lens id goes in `catalog.illustrationLenses`, so discovery never counts it, and it is never the default lens | Makemake, Eris and Haumea `illustration` (NASA VTAD models) | `tools/objects/shape-model/glb-surface.test.mts`, `site/test/object-discovery.test.mts` |
| A planet of another star with a published longitude-latitude map | Astronomy record `classification: exoplanet` with a `hostedOrbit` block around a placed star (`packages/astronomy/src/hostedOrbits.ts`), rotation `cssearth-synchronous-rotation@1` (`tools/objects/authored-rotation.mts`), and a `terrestrial-scientific` lens with `format: npy-dictionary-map` on the emissive route (`tools/objects/terrestrial-layers/npy-pickle.mts`, `tar-member.mts`); paint the atlas from `outputLongitudeOrigin: -90` | WASP-43b `temperature`: Challener et al. (2024) JWST NIRSpec eclipse map, Zenodo tar read in place | `tests/objects/unit/wasp-43b/eclipse-map.test.mts` turns the map with the package's orbit and rotation (`tools/objects/eclipse-map/phase-curve.mts`) and fits the deposited light curve; `default-view.test.mts` pins the substellar view | Photometry cannot tell north from south; the orbit's node on the sky is a display convention |
| A wide companion whose orbit is not measured | An `orbit-family` source naming a LOFTI results file (`tools/objects/binary-orbits/lofti-fit.py`, `tools/objects/binary-orbit-family.mts`); preparation draws its first `displayed` orbits around the primary as the body's `orbit` and `additionalOrbits`, with `placement: candidate-orbits`. The body keeps its own astrometric position, which lies on none of them, and the candidates frame no system view | HD 189733 B around HD 189733 A (Gaia DR3 astrometry, no published orbit) | `tools/objects/binary-orbit-family.test.mts` (each candidate reproduces the measured separation and position angle), `src/preparation/spatial-context.test.ts`, `tools/objects/prepare-spatial-context.test.ts` | Drawn dashed and only once the whole family fits the view; a rerun of the fit draws a different sample |
| A placed star whose spin axis is measured against its planet's orbit | `cssearth-measured-obliquity-pole@1` (projected obliquity, stellar inclination, true obliquity checked against them, equatorial period; `tools/objects/authored-rotation.mts`) or `cssearth-orbit-aligned-pole@1` when only an aligned projected angle is measured | HD 189733 A (Cristo et al. 2024); WASP-43 (aligned) | `tools/objects/authored-rotation.test.mts`, `tests/objects/unit/hd-189733/source.test.mts` | The axis's position angle on the sky follows the orbit's display convention |
| An eclipse map deposited without grid arrays or covering unobserved longitudes | `npy-dictionary-map` with `gridLayout: pixel-centres` and `visibleLongitudes` (ThERESA's rule from the deposit's own observation times) | HD 189733b `temperature` (Lally et al. 2025, output_E.npy) | `tools/objects/terrestrial-layers/npy-pickle.test.mts`, `tests/objects/unit/hd-189733b/eclipse-map.test.mts` | Unobserved columns are missing data, as in the authors' figures |
| A placed star with no measured rotation axis | `cssearth-display-orientation@1` rotation record with the pole set to sky north in the plane of the sky and `displayMeridianDegrees` facing the Earth; star record `presentationUp: display-axis` (`packages/astronomy/src/stars.ts`, read by `tools/prepare-solar-geometry.mts`) so the presentation frame and the camera orbit use that axis instead of the ecliptic pole | π¹ Gruis `pionier`: Paladini's image-ready PIONIER OIFITS from the OiDB read as is, `tools/objects/interferometry/oifits-rows.mts` for the per-channel fit | `tests/objects/unit/pi1-gruis/{camera,default-view}.test.mts` | The axis is a labelled convention; a star far from the ecliptic would otherwise never face its sub-Earth point |
| A default camera angle, a body orientation or an off-limb plate turn | Nothing authored: `src/platform/default-camera.mts` derives the camera (photograph frames, a self-luminous body facing the Sun, or the lit design pose); the world-navigation stage solves the system node so the drawn body is in the ecliptic presentation frame; `prepareSkyNorthScreenAngleDegrees` turns the plate. Recipes that state `initialScenePitchDegrees`, `defaultControlYawDegrees` or `offLimb.rotationDegrees` are refused | Amalthea (photo mosaic), Betelgeuse (star and plate), Callisto (lit pose) | `tools/objects/default-view.mts` measures the result through the runtime camera math | The world-navigation stage owns the pose: `node tools/prepare-object-json.mts --keep-bindings` re-applies a rule change to every object in seconds; the five planet lanes bake lighting at the rule's pitch and re-bake only when it changes |
| The default camera of a photograph lens on the planet route | `tools/objects/default-view.mts` (`assertDefaultViewFacesLens`, run by `prepare-authored` for every `surface-observation` lens) | Betelgeuse `default-view.test.mts` | The runtime's scene matrix and `worldCameraFromPresentation` give the sub-camera point and the screen angle of any direction without a browser | Preparation refuses a default view more than 25 degrees from the lens's sub-observer point; the test pins the browser-measured angles |

For `controlled-shape-color`, each band set is one observing triplet. A point is
colored only where all three of its bands qualify, and band sets compete for a
point like the frames of a monochrome mosaic. Level matching scales the three
bands of a set by one gain, so their measured ratios stay. Cameras named in
`registration` are measured again against their reference images before any
pixel is sampled. The runtime consumes the same prepared color atlas.

When a photographed patch ends at a straight boundary, trace that edge to the
detector bounds and validity masks, then inspect adjacent pointings in the
archive sequence. A real detector edge can still mean the selected mosaic is
missing available neighboring observations. Qualify those cameras and complete
filter sets before expanding coverage; do not stretch the existing image.

Routes with Sun geometry accept a published photometric model record (see
`tools/photometry/README.md`), and [photometric models](photometric-models.md)
lists which bodies have one. Kernels that serve several bodies of one mission
live in a kernel bank under `src/spice/<mission>/`: add, restore and verify them
with `node tools/spice/kernel-bank.mts`, and name the bank with `spice.kernelSet`.

A star other than the Sun is a placed body. `packages/astronomy` carries its
catalogue astrometry (`star` record: ICRS position and epoch, distance, proper
motion, radial velocity, each with its source), `tools/prepare-solar-geometry.mts`
places it by that state instead of an orbit, the Sun's world context lists it
with a position and no trajectory (`orbitStyle: none`), navigation reads its
distance in parsecs, and the overview rule that opens the Solar System when the
camera leaves it anchors on the star itself. The reference surface is a sphere at
the published radius written as a radius table, as Annefrank's ellipsoid is. The
Sun direction from such a body is the direction to Earth within a thousandth of a
degree, so incidence equals emission and `retained-observation` photometry keeps
the reconstructed intensity. The baked sky cube is the Sun's; beyond the star
band the runtime hands the sky to the 3D star field, so the cube fades out there.

## Registered photographic mosaics

For photographs with per-pixel surface geometry, read
[registered photographic mosaics](registered-photographic-mosaics.md). The 67P
OSIRIS example below was inspected at commit
`fde7dc8f3f35f6c56fee440b24bc7041a47255a2` in PR #49. Check the selected checkout
for availability; this reference does not establish merge or deployment status.

| Capability | Owner relative to the repository |
| --- | --- |
| Observation pins, quality policy, photometry and transfer limits | `src/objects/comet-67p/source/preparation/terrestrial.json` and `acquisition.json` in the same directory |
| OSIRIS decoding, companion identity and quality flags | `tools/objects/terrestrial-layers/osiris-geo.mts` |
| Projective fit with a disjoint holdout, footprint sampling, source-mesh correspondence and visibility | `tools/objects/surface-observations/`, described in its [README](../../../../tools/objects/surface-observations/README.md) |
| Deterministic surface samples, bounded overlap gains and observation selection | `tools/objects/surface-observations/levels.mts` |
| Atlas baking and lossless observation-index output | `tools/objects/terrestrial-layers/radial-terrain.mts` |
| Selection/level regressions and prepared provenance checks | `tools/objects/surface-observations/levels.test.mts`, `tests/objects/unit/comet-67p/mosaic.test.mts` |
| Worked method, limitations and measured evidence | [67P source and evidence account](../../../../src/objects/comet-67p/README.md) |

Inspect the actual recipe/schema before reuse. The OSIRIS decoder and quality
bits are instrument-specific; source identity, geometry qualification and
provenance are transferable requirements. 67P's distances, angles, sample counts,
photometric model and gain limits are evidence for that dataset, not defaults.

Archives that ship an image with its geometric backplanes as one PDS4 cube use
the same pipeline through `format: "pds4-geometry-cube"`: the recipe's `cube` block
names the label planes that carry the image, the X/Y/Z intercepts and the
angles, the collection, target, observing system and DSK to bind, and optional
FITS header expectations. `tools/objects/terrestrial-layers/pds4-geometry-cube.mts`
validates all of it against the label (offsets, units, special constants) and
the header, converts units, and recovers nothing else; the camera comes from the
shared fit above. Dimorphos's DART DRACO view
(`src/objects/dimorphos/source/preparation/terrestrial.json`) is the first
instance; a second archive needs a recipe, not a decoder. Frames that share one
viewing direction use `selection: "recipe-order"`, finest footprint first,
because lowest-emission selection cannot separate them. The
[Dimorphos README](../../../../src/objects/dimorphos/README.md) records the
measured residuals, transfer distances and the archive's pixel-scale unit slip.

A cube can contain intercepts for multiple bodies in their respective local
frames. Its optional `cube.geometrySelection` declares a native geometry plane,
its exact label unit, an inclusive interval and its interpretation. Selection
applies before camera fitting and to every interpolation contributor; it never
uses brightness. Didymos uses the archived radius plane to separate its
0.2–0.5 km intercepts from Dimorphos. Tests bracket both complete source meshes,
require camera holdouts and check the selected points against Didymos's mesh.
The DART label lists only the companion's DSK, so Didymos separately binds
`SHAPREF1` and documents that archive inconsistency. Do not interpret a label's
single DSK entry as proof that every pixel belongs to that shape.

Archives that ship images with SPICE kernels and no geometry at all use
`format: "spice-camera"`: the recipe's `spice` block names the kernel set (pinned
inputs of the observation's consumer group, in metakernel order), the observer
and target SPK ids, the body-fixed frame, the instrument whose `INS<id>_*`
variables define the pixel model, the header card that carries the exposure's
spacecraft clock, the aberration correction (`LT+S`, `LT` or `NONE`), the
instrument-frame axes that stored columns and rows follow, and how the image
plane and its flag values are read. `tools/spice/` is the strict-TypeScript
kernel subset (DAF, SPK types 1, 2, 3, 5, 8, 9 and 13, CK types 1 to 3, text
kernels, leap seconds, SCLK, PCK pole models, frame classes 2 to 6, light time
and stellar aberration) and `tools/spice/camera.mts` assembles the camera;
`tools/objects/terrestrial-layers/spice-camera.mts` turns it into the same
`cssearth-archived-camera@1` closure the OSIRIS and L'LORRI formats use, and
`castSourceRays` derives per-pixel geometry from the full source mesh. The
route is validated end to end against Dimorphos's DRACO backplanes in
`tests/objects/unit/dimorphos/draco-spice.test.mts` (0.5 px against the
archive's own intercepts, the constant offset explained by kernel versions).
Tethys's Cassini ISS lens is the first lens on this route. It reads its kernels
from the shared Cassini bank, decodes a VICAR image, and evaluates the camera at
mid-exposure from the clock counts in the PDS3 label (`image.format:
"vicar-pds3"`, `clock.start` and `clock.stop`). `IAU_<body>` frames resolve
without a frame kernel, as they do in SPICE. A recipe may constrain separation
among bilinear image contributors. This is distinct from correspondence between
the displayed mesh and the source mesh; applying a contributor-distance limit to
that correspondence can create false coverage holes. Use the current
[transfer policy](../../../../tools/objects/surface-observations/README.md#route-policy)
and [contributor limits](../../../../tools/objects/surface-observations/README.md#transfer-limits)
rather than copying a distance from another body.

Archived and kernel pointing carries the archive's error: a fraction of a pixel
for a solution tuned to the images, tens of pixels for a reconstructed C-kernel.
A `spice-camera` or `osiris-camera` recipe may declare `limbRefinement: { method:
"mesh-limb", maximumCorrectionDegrees, maximumResidualPixels, minimumControls,
searchPixels?, maximumControls?, minimumSharpness?, threshold? }` and
`tools/objects/terrestrial-layers/limb-refinement.mts` then fits one rotation of
the camera to the lit limb of the retained mesh before geometry is derived:
edges are the sub-pixel coverage crossings of the body against background
connected to space, sharp enough not to be terminator; each edge is matched to
the mesh limb along its normal; terminator edges are recognised because the
limb they reach faces away from the Sun; the match window grows until the
count plateaus; a damped least-squares fit with a robust cut follows; and the
holdout half of the edges must land within the declared residual budget, with
the correction below its bound, or preparation refuses the frame. The report
(correction, residuals before and after, matched fractions) lands in the lens
metadata. Range, focal length and Sun direction are never changed.
`tests/objects/unit/dimorphos/draco-refinement.test.mts` measures it against the
DRACO backplanes: the kernel camera stays within 0.6 px of the archive, and
cameras pushed 30 and 150 px away return to 0.24 and 0.55 px.

For an initial comparison of published planetocentric coordinates with native
image picks, `tools/objects/surface-features/check-projected-controls.mts` replays
a pinned `cssearth-projected-controls@1` recipe. It uses the existing FITS reader,
OBJ mesh and archived-camera contract, reports visibility and pixel discrepancies,
and renders the native picks beside projected positions. It does not fit a camera,
set acceptance limits or qualify a surface. Keep ambiguous identifications explicit;
a sketch-assisted identification region is not a measurement uncertainty. Pallas's
`evidence/photographic-controls.json` is a diagnostic example with unresolved
feature and coordinate correspondence, not a photographic preparation template.

The PDS3 routes (OSIRIS GEO, AMICA) stay instrument decoders behind the same
pipeline, decided 2026-09-12 after a code review: their archives do not declare
plane units or semantics the way a PDS4 label does, and about half of each
decoder is instrument policy (quality-bit polarity and HISTORY radiometry for
OSIRIS; gzip band reversal and the paired flat for AMICA), so a declaration
would restate constants while turning validity policy into data. Revisit only
if a third attached-label, pointer-addressed PDS3 geometry archive appears.

## Oracles

The pipeline derives nothing from an oracle; an oracle recomputes what the
pipeline computed so a test can compare. `tools/oracles/` holds them with a
pinned Python environment (`pnpm oracles:setup`, `tools/oracles/requirements.txt`),
and each writes a fixture under `tests/oracles/` that names its versions and the
sha256 of every input. Existing decoder references include
SpiceyPy for `tools/spice/` (a microsecond in time, a millimetre in position, a
nanoradian in rotation); pds4_tools for the PDS4 geometry cube; pvl and numpy for
the OSIRIS geometry, OSIRIS reflectance, AMICA and ISIS2 readers; astropy for
the L'LORRI reader and its TAN-SIP distortion and for the three encounter FITS
layouts. Comparing tests sit beside each reader, and `tools/oracle-fixtures.test.mts`
refuses a fixture from an unpinned environment or unpinned inputs. A new scientific
source-format parser, decoder or interpretation algorithm needs independent reference evidence.
Use the existing pinned oracle framework for new decoding behavior; do not use
the implementation's own output as its expected result.
Reusing validated readers or composing an existing route needs focused consumer
checks; it does not automatically require another oracle environment or regenerated
fixtures. Camera controls still need their geometric checks. Regenerate a fixture
only when its tool or inputs change, and say so in the PR. ALE and usgscsm (pixel models and
distortion) need conda and arrive with the first Cassini ISS lens. ISIS's
photometric models are checked against the truth files of their unit tests,
which need no ISIS install. See `tools/oracles/README.md`.

For SUM/INFO image-to-shape investigations, use the optional
[native SBMT preparation oracle](../../../../tools/oracles/sbmt/README.md).
Add a source-pinned case to its shared inventory rather than writing a body-only
reference script. Its staged comparison separates pointing, visible intercepts,
FITS samples and UV projection. SBMT's angular UV approximation is not exact
pinhole projection, and its clamped off-image UVs are not photographic coverage.
Keep discrepancies explicit; a green regression test can mean a known mismatch
was correctly detected. A/A repetition establishes reproducibility, not source
registration. Oracle output must never become a camera recipe or surface input.

## Commands and test routing

Read `package.json` for the selected checkout. The commands below have distinct
purposes; run those needed for the task, not every preparation step by default.

| Purpose | Current entry point |
| --- | --- |
| Build shared tool bundles when needed | `pnpm build:tools` |
| Install already published prepared files | `pnpm setup:assets --object=<id>` |
| Restore missing source pins and verify existing bytes | `node tools/objects/dist/operations.js acquire <id>` |
| Verify source closure without acquiring | `node tools/objects/dist/operations.js acquire <id> --verify-only` |
| Prepare selected objects through the cache and shared steps | `pnpm prepare:planets -- --object=<id>` |
| Create the oracle environment and regenerate oracle fixtures | `pnpm oracles:setup`, then `pnpm oracles:run [group/name ...]` |
| Invoke authored preparation directly | `node tools/objects/dist/prepare-authored.js <id> --write` |
| Prepare one authored object end to end, resumable by step | `node tools/prepare-object.mts <id> [--from <step>] [--presentation-only]` (the last reuses a paged-ellipsoid body's published heavy outputs): stale builds, pins, catalogue, title, geometry, write mode, discovery, source records, page, text, markers, world context, provenance for this object only |
| Say which build a run would read stale | `node tools/check-stale-builds.mts` |
| Repin authored, generated and tool-written files; adopt a new download's first pin | `node tools/pin-object-documents.mts <id> [--check] [--adopt-downloads]` (write mode runs it; manifests pinning a repository output follow the world-context writer) |
| Re-prepare only the content record after a credit or provenance edit | `node tools/objects/refresh-content.mts <id> ...` (refuses if any other prepared file would change) |
| Find what the literature published for a resolved-star candidate | `node tools/objects/star-candidates.mts "<SIMBAD identifier>"`: OiDB calibration levels, VizieR image deposits from the star's own papers, and the route that worked for the placed stars; archive leads (`tools/objects/archive-search.mts`) from the JMDC measured diameter, ALMA projects with beams across the disc, ESO interferometer and adaptive-optics frames, HST and JWST imaging, and DataCite deposits of the star's papers |
| Image a star from one raw season and decide whether it may be cast | `node tools/objects/interferometry/image-star.mts <season dir> <work> [--raw <dir>]`: a `seasons/<id>/season.json` pin; calibrates, selects, fits the disc, reconstructs the season, halves and spotless twins with SQUEEZE, writes `verdict.json` and compares with the author's file and image; see [Interferometric imaging](../../../../docs/interferometric-imaging.md#one-command-per-star) |
| Install a pinned interferometry toolchain (SQUEEZE, ROTIR, ESO PIONIER, AMBER, GRAVITY, MATISSE) | `node tools/objects/interferometry/toolchain.mts install <id>`: `toolchains.json` pins, installs under `output/toolchains/` |
| Calibrate PIONIER visibilities from raw frames | `node tools/objects/interferometry/calibrate-pionier.mts <work> --target <OBJECT> --from <ISO> --to <ISO>`: plan from the ESO raw table, esorex and pndrs; see [Interferometric imaging](../../../../docs/interferometric-imaging.md) |
| Calibrate AMBER visibilities from raw frames | `node tools/objects/interferometry/calibrate-amber.mts <work> --target <OBJECT> --from <ISO> --to <ISO> --calibrator <NAME>=<mas>:<error>`: amdlib chain, per-baseline frame selection, CO wavelengths |
| Calibrate a GRAVITY or MATISSE exposure from raw frames | `node tools/objects/interferometry/calibrate-gravity.mts <science dp_id> <work>` or `calibrate-matisse.mts`: follows the archive's calselector tree, one science and one calibrator exposure |
| Select channels, nights, error floors or a wavelength scale before a reconstruction | `node tools/objects/interferometry/oifits-select.mts <in> <out> [--window min:max] [--mjd min:max] [--half even\|odd] [--error-floor <fraction>:<degrees>[:<minimum>]] [--wavelength-scale f]` |
| Reconstruct a surface on a sphere | `node tools/objects/interferometry/surface-reconstruction.mts <oifits> <dir> --diameter-mas <d>`: ROTIR on HEALPix, writes the map and its sky projection |
| Decide whether a reconstruction may be cast | `node tools/objects/interferometry/spotless-disc.mts simulate ...`, reconstruct both, then `compare ... --chi2 <vis2>:<closure> --halves-correlation <r>`: fit within 3, spots at least twice the spotless disc's, and halves (`oifits-select.mts --half even|odd`, `spotless-disc.mts reproduce`) correlating at 0.5 |
| Cast a sphere reconstruction onto a lens | `node tools/objects/interferometry/surface-lens.mts <surface-grid.fits> <map.fits>`: body longitudes, recipe `outputLongitudeOrigin: -90` |
| Install the pinned Eureka! environment for raw JWST reductions | `node tools/objects/jwst/toolchain.mts install`: micromamba Python 3.11 plus `requirements.lock` and one source patch, under `output/toolchains/eureka` |
| Reduce a JWST time series from raw exposures | `node tools/objects/jwst/reduce-tso.mts tools/objects/jwst/programs/<id> <work> [--raw <dir>]`: Eureka! stages 1-4 in memory-safe batches, light curves exported to CSV with the author's deposit; then `compare-light-curves.mts`; see [Eclipse mapping](../../../../docs/eclipse-mapping.md) |
| Find whether an archive holds finer frames than a body ships | `node tools/objects/imagery-candidates.mts [<id> ...] [--minimum-pixels 50] [--json]`: OPUS's finest body-centre image resolution per covered body against the finest frame its photograph lenses cast, with pixels across and phase; advisory, since a frame still needs a camera, registration and reuse terms. `--archives <id> ...` searches ALMA, ESO raw frames and MAST under the body's catalogue name and SBDB designations, and DataCite for deposits of the papers it already cites |
| Set up a VLT/SPHERE survey body's photograph lens and measure it against the survey figure | `node tools/objects/sphere-survey/setup.mts <id>` in scratch, then `node tools/objects/sphere-survey/install.mts <id>` into the package; see [SPHERE survey photographs](sphere-survey-photographs.md) |
| Write a ground-based lens's two Horizons tables | `node tools/objects/sphere-horizons.mts <id> [--write]`: Paranal rows at each frame's exposure start and heliocentric vectors one light time earlier, asked in batches of 25 and pinned in the manifest; a table the manifest does not name yet is declared for `pnpm author:sources` |
| Measure a ground-based lens against its paper's comparison figure | `node tools/objects/published-comparison.mts <id> [--write]`: reads the figure from the pinned PDF (`tools/pdf-image.mts`), writes `evidence/published-comparison.json` and its image; a new record's zero pixel digest is adopted on the first `--write` |
| Scaffold a placed star from its astronomy record | `node tools/objects/new-star.mts <id> --name ... --paper ...`: every number derived, prose marked `TODO(new-star)`, then `prepare-object` |
| Restore sources before root preparation | `pnpm prepare:checkout` |
| Build the site and assemble declared runtime files | `pnpm build` |

Default acquisition restores missing pins from `source/preparation/acquisition.json`
and fails on changed existing bytes. `tools/restore-source-inputs.mts` delegates
selected objects to shared acquisition; it also restores Earth's pinned WMTS
inputs. `setup:assets` installs prepared files independently of source preparation.

`tools/run-implemented-planets.mts` discovers registered objects and selects the
authored commands. It routes `test:planets` to `tests/objects/unit/<id>/` plus the shared contract runners in `tests/objects/unit/*.test.mts`, scoped to one body through `CSSEARTH_TEST_OBJECTS`.
`pnpm test` currently runs packages, renderer, platform and shell checks;
`test:planets` and `test:preparation` are separate commands.

`pnpm test:browser` currently runs DOM cleanliness. Shared interaction
conformance is `pnpm test:browser:conformance`. Browser profiles live in
`tests/objects/browser/<id>/`, use `site/test/object-browser-profile.mts`, and
consume prepared controls. `site/test/load-browser-profile.mts` already handles
absent lenses and requires race inputs only when more than one lens exists.
Use the actual command coverage when reporting proof; readiness requirements
belong to the user's contract and [qualification](qualification.md).
