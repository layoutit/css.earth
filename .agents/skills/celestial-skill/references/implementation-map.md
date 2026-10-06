# cssEarth implementation map

Paths are relative to the selected repository. The documentation links were
checked on 2026-09-09.
Camera conversion, default-view rotation, silhouette walking and fly-to calibration belong to `@cssearth/engine`.
Objects owns parsed formats and depends only on core; parse camera records with `requireCamera` before calling engine.
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
  prepared/                           generated runtime/content/controls JSON
  inventory.json                      generated inventory of every baked file and its hash

public/scenes/<id>/                    prepared assets
site/pages/[id].astro                  one shared route for all body ids
packages/bake/authoring/<id>/               focused hand-written body tests
packages/bake/authoring/<id>/browser-profile.mts
```

The [documentation contract](../../../../docs/provenance/CONTRACT.md) explains
where body docs and evidence go. Every file under `source/` needs a manifest
entry. Keep test logs and browser screenshots outside it.

Use `site/build/object-package-contract.mts` for actual required files. Its authored
branch is selected through `packages/bake/src/sources/authored-object.ts`; the legacy branch still
mentions `runtime/client.mjs`, package Astro pages, and per-body tools. Those
fallback requirements are not the current authored-package template.

## Find the owner for the change

| Change | Source owners |
| --- | --- |
| Identity, route, lazy loading | Body `object.json` → `site/build/prepare/prepare-catalog.mts` → `site/directory/objects.mts`; `site/scene/object-adapter.mts`, `site/scene/packaged-object-runtime.mts` |
| Physical data, orbit records and acquisition choices | `packages/astronomy/data/bodies/<id>.json`, `packages/astronomy/cli/body-records.mts` |
| Authored and prepared object contracts | `packages/objects/src/descriptor.ts`, `packages/objects/src/authored.ts`, `packages/objects/src/prepared-data/runtime-validation/` |
| Preparation dispatch and publication | `site/build/prepare/prepare-authored.ts`, `packages/bake/src/delivery/publication.ts`, `site/build/prepare/prepare-object-json.mts` |
| Source acquisition, verification and runtime inventory | `packages/bake/src/objects/acquisition/operations-acquisition.ts`, `packages/bake/src/objects/sources/source-files.ts`, `packages/bake/src/objects/acquisition/object-operations.ts`, package source manifests and acquisition JSON |
| Retained scene, selection, resources and lifecycle | `packages/renderer/src/runtime/object-runtime.ts`, `packages/renderer/src/rendering/`, `packages/renderer/src/runtime/shell-contract.ts`, `site/scene/scene-router.mts` |
| Shared input, world camera and physical registration | `site/browser/runtime-policy.mts`, `packages/renderer/src/navigation/`, `packages/renderer/src/rendering/prepared-camera-runtime.ts`, `packages/bake/src/objects/scene/world-navigation.ts` |
| Shared page and content presentation | `site/pages/[id].astro`, `site/components/ObjectPage.astro`, `site/server/object-page-data.mts`, `site/contracts/object-page-contract.mts`, `site/layouts/ObjectLayout.astro` |
| Content, dataset labels and minimap preparation | `@cssearth/bake/objects/content` (the content contract, dataset labels, dataset steps and legends), `site/build/content/prepare.ts`, `@cssearth/bake/surface-previews` (`surface-minimaps.ts`) |
| Search and marker presentation | `site/search/search-objects.mts`, `packages/bake/src/navigation/prepare-navigation.ts`, `packages/renderer/src/navigation/marker-presentation.ts` |
| Open hyperbolic trajectories | `packages/astronomy/src/kepler.ts`, `packages/bake/src/world-context/hyperbolic-path.ts`, shared world-context preparation and orbit validation/projector |

Minimap preparation accepts authored source paths and prepared source records.
For a prepared surface, `map.url` identifies the preview image; its `source`
object records provenance and must not be treated as a file path. The parser
lives in `packages/bake/src/surface-previews/surface-preview-source.ts`.

For an unbound body, use the shared prepared hyperbolic path with explicit open
endpoints and an epoch vertex. Do not wrap its anomaly, close its last edge or
invent a revolution period. The finite display window is not a physical bound
or a propagation-accuracy claim. See [open trajectories](../../../../docs/prepared-navigation-ownership.md#open-trajectories).

Follow the selected preparation branch into its reusable implementation under
`packages/bake/src/objects/` (per-body processing scripts sit in
`packages/bake/authoring/<body>/`, or `packages/telescope-cli/authoring/<body>/` for telescope work). Preparation owns geometry, source interpretation, atlases,
lighting and other scene assets; the shared CSS renderer consumes prepared data.
Body facts stay in the package. Extend a shared capability only when the source
requires behavior the existing capability cannot express.

`site/pages/[id].astro` derives routes from `OBJECTS` and passes the selected id
to `ObjectPage.astro`. That component loads the body's prepared page and content,
applies its declared stylesheets, and uses the shared head/panel and `ObjectLayout`.
`site/directory/objects.mts` loads descriptors through `loadPackagedObject`. Preserve one
registry, generic adapter, shared shell and active object scene; navigation uses
the shared world camera.

Navigation marker appearance comes from each authored package's
`source/preparation/navigation.json`, which names its source image by path;
the pins and attribution are the source manifest's record. `packages/bake/src/navigation/prepare-navigation.ts` generates
individual `public/navigation/body-<id>.webp` images and their 2x counterparts.
Builds assemble the ignored `site/prepared/prepared-navigation-markers.mjs` from those
images and recipes; `ObjectNavigationMarker.astro` consumes it. Follow the
[registration steps](../../../../src/objects/README.md#register-a-body-without-editing-shared-lists)
instead of editing a shared list or atlas position.

## Choose examples by source needs

- **Different meshes for different datasets:**
  `geometry.radialTerrainAlternatives` binds each alternative profile to a
  `datasetId`. `packages/bake/src/objects/layers/terrestrial/radial/radial-models.ts` loads the models
  at a common physical scale; `solid-scene.mts` prepares selection and picking
  ranges in one retained scene. Borrelly (`comet-19p`) and Tuttle (`comet-8p`)
  use this path. Verify only the selected model is visible and pickable, camera
  behavior remains shared, and the combined prepared asset bank meets the budget.
  A dataset takes a mesh of its own only when it is itself another shape: a second
  shape model, or a picture registered to one. A map of the same body draws on
  the body's mesh. Picking a dataset on another mesh swaps every face in one
  frame: 0.5 to 1.1 s on an iPad for comet 67P's 1,000 to 2,000 faces when its
  model, photographs and VIRTIS maps each had their own (2026-10-05). A map
  published on another model of the same body names that model as an alternative
  with `"display": "body-mesh"`: each texel is read at the closest point of that
  model's surface and drawn on the body's mesh, as Bennu's six facet tables are
  from four versions of its shape. The default dataset may draw on either mesh:
  the 35 VLT/SPHERE asteroids open on a photograph that rides its own.
- **One atlas size for a body's datasets:** on a mesh of triangles every face
  draws its atlas at the layout's size. A dataset with `textureScale` below 1 is
  drawn enlarged, which Safari does with a cropped copy for each face: comet
  67P's 1,992 faces took 731 to 842 ms to switch to a half-size atlas and 202 to
  236 ms to a full-size one on an iPad (2026-10-05). Set `texelsPerFace` to what
  the datasets need and leave `textureScale` out. A banded sphere follows the
  same rule with one `textureScale` for its maps: Enceladus's elevation atlas
  at full size, 8,320 pixels wide among 2,080 pixel ones, took 568 to 613 ms to
  pick and 51 to 68 ms at their size.
- **Observation mosaics:** Triton's `source/preparation/terrestrial.json` uses
  the shared terrestrial path (`packages/bake/src/objects/layers/terrestrial/`) for native image geometry,
  photometric correction, compositing and gaps. Reuse the capability with the
  target body's inputs and conventions.
- **Photometric normalization:** `@cssearth/bake/photometry` (`packages/bake/src/photometry/`) evaluates published
  photometric models, including Hapke with macroscopic roughness, for the
  surface-observation and shape-camera routes. Lutetia's
  `source/photometry/` record and its manifest binding are the worked example;
  `packages/bake/src/photometry/isis.oracle.test.mts` holds the library to the values ISIS
  prints.
- **Elevation relief:** Ceres's `source/preparation/terrestrial.json` supplies
  its height datum, validity limits and cartographic lighting to
  `packages/bake/src/objects/raster/scientific-raster.ts`. These values and gap
  rules belong to its dataset.
- **Spectral absorption maps:** Charon's `source/science/leisa/bands.json`
  pairs LEISA spectra with wavelength and geometry cubes.
  `packages/bake/src/objects/layers/observation/spectral-band-maps.ts` prepares footprint-limited
  numeric maps; `packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.py` independently checks the
  native samples and arithmetic. Follow the spectral guidance in
  [scientific faithfulness](scientific-faithfulness.md).
- **A sourced shape model:** Haumea's `source/preparation/shape-model.json` uses
  `packages/bake/src/objects/layers/shape-model/shape-model.ts`, with one entry per dataset in its `surfaces` list. Inspect both the authored schema and that
  preparer's actual shape support before choosing it for another body; verify
  camera picking in the shared renderer if the new geometry requires it.
- **Published ellipsoids and unresolved outlines:**
  `packages/bake/authoring/distant-worlds/README.md` documents the existing
  analytical radius-table extraction. Its helpers accept a selected input file;
  `packages/bake/authoring/outer-worlds/inputs.json` supplies the later
  occultation and thermal examples.
  Keep a projected ellipse distinct from a 3D shape, disclose any assumed depth,
  and use the normal unmapped grid. A short title must match the content display
  name; a longer designation can remain in the shared registry for search.
- **Measured irregular radial terrain:** Vesta's
  `source/preparation/terrestrial.json` selects `geometry.radialTerrain`, native
  `primitive: "u"`, and optional meshoptimizer simplification. Read
  [irregular meshes](irregular-meshes.md) before using this branch. The owners
  below were verified in Vesta PR #24 on 2026-09-07; inspect the
  selected checkout for availability rather than assuming that revision is merged.

| Irregular-mesh capability | Owner relative to the repository |
| --- | --- |
| Source loading and native triangle planning | `packages/bake/src/objects/layers/terrestrial/radial/radial-terrain.ts` |
| Source sampling, position welding, compaction, meshoptimizer simplification and topology checks | `packages/bake/src/objects/geometry/radial-mesh.ts` |
| Per-texel lighting and material atlas baking | `packages/bake/src/objects/layers/terrestrial/radial/radial-materials.ts` |
| PDS radius values / OBJ radial intersections | `packages/bake/src/objects/raster/pds/pds-scalar-grid.ts`, `packages/bake/src/objects/geometry/obj-shape.ts` |
| Geometry regressions and independent body anchors | `packages/bake/src/objects/geometry/radial-meshoptimizer.test.mts`, `packages/bake/src/objects/layers/terrestrial/radial/radial-terrain.test.mts` |

The OBJ sampler supplies radius by ray intersection; this route resamples the
shape and does not retain arbitrary OBJ connectivity or UVs. It is not proof of
a general full-mesh rendering capability.

These examples identify implementations to inspect, not universal visual or
scientific templates. See [qualification](qualification.md) for source and
browser comparisons relevant to the actual feature.

## Choose a photograph route

Start with the [photographic investigation route](photographic-investigation.md):
an existing map need not pass through camera reconstruction. For supported
cylindrical photographic maps, `packages/bake/src/objects/layers/terrestrial/native-photograph-source.ts`
reads the pinned raster with its declared grid and validity policy;
`native-photograph.mts` samples it onto existing triangle-atlas rectangles.
`radial-terrain.mts` selects this path through an observation's
`nativePhotographicSampling`. Inspect its source-schema and configuration guards:
it does not accept arbitrary projections, recover a paper figure's registration
or establish compatibility with another shape. Source and atlas checks live in
`native-photograph-source.test.mts` and `native-photograph.test.mts` beside those
owners. These paths were inspected.

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
| Images with SPICE kernels and no geometry | `spice-camera` | Tethys `iss`: a Cassini ISS VICAR image with its PDS3 label | The `spice` block: kernel bank and kernels in load order, bodies, body-fixed frame, instrument, clock keywords, pixel axes; limb refinement | `packages/bake/src/objects/cameras/dart-draco.oracle.test.mts` |
| A push-frame color image from a spinning spacecraft, with SPICE kernels and no geometry | `junocam-camera` | The four JunoCam images of Europa (29 September 2022), measured in the [JunoCam guide](../../../../docs/junocam.md) | Frame and label pins; the `spice` block naming the kernel bank, kernels in load order, bodies, the label's target name and the body frame; `epochRefinement` budgets for the two epochs fitted to the lit limb; retained illumination or a disk function; a `displayRange` from 0 | `junocam.test.mts` (the instrument kernel's own field-of-view vectors), `strip-refinement.test.mts` (known epochs recovered from a synthetic spinning camera), `packages/spice/src/camera.test.ts` |
| Encounter FITS frames with a control network | `encounter-fits` | Wild 2 `navcam`, Tempel 1, Hartley 2 | Frame, label and control pins, level matching | `encounter-fits.oracle.test.mts` |
| Published camera controls for a shape model, or the Galileo SSI image catalog | `controlled-shape-camera` | Ida and Gaspra `calibrated`, and 20 other small bodies | Frame pins with the control network's camera fields or a `cameraCatalog`, photometry, transfer limits, level matching | None yet; preparation refuses a frame whose camera puts more than a quarter of its lit shape on sky |
| A camera dataset whose named reference may turn or tilt it | `refinement` on the dataset recipe, applied in `surface-observations/observations.ts` through `cameras.ts` `turnedCamera` and `tiltedCamera`, kept only if re-measurement improves what it came from | Psyche `zimpol`: a 5° tilt kept | The stage measures, the named reference's decisive median turns every camera once when no other decisive reference disagrees, and the turned dataset is measured again; every backplane camera now carries a Sun fitted from the archive's phase plane | `cameras.test.mts` (Sun fit to 0.01°, refused when no single Sun explains the plane, turned camera), `registration.test.mts` (agreement rule) |
| Registration of any camera route against the surface | registration stage in `surface-observations/registration.ts` | every camera dataset; Tethys `iss` names its `normal` map as the reference | Silhouette residual with its noise floor and the reference sweep (map or the dataset's other frames) reported under `registration` in the dataset report and written into the body README by `packages/bake/cli/report-registration.mts`; `packages/bake/cli/registration-stage.mts` re-measures a body without re-preparing it | `registration.test.mts` (synthetic elongated body: right and wrong pole, partial disc, frames as reference), `report-registration.test.mts` (README block equals the prepared report) |
| Ground-based telescope frames with no archived geometry | `controlled-shape-camera` with `fits-zimpol-intensity` | Sylvia `zimpol`: deconvolved VLT/SPHERE/ZIMPOL frames | Frame pins with cameras computed by `observer-camera.ts` (`@cssearth/bake/objects/cameras`) from a rotation model, Horizons geometry and each frame's header, all named in `source/preparation/observer-cameras.json` and written into the recipe by `packages/bake/cli/observer-cameras.mts` (exposure-midpoint epoch, limb-fitted centre); the mesh the rotation model describes, as a `radialTerrainAlternatives` entry. The model is the release's spin record (`spinOrientation`), read in the column order its published pole supports (`spin-record-reading.mts`), or, for a body a text PCK describes, its IAU pole model (`pckOrientation` over the shared `pck00011.tpc` and a leap-second kernel). `packages/bake/cli/sphere-horizons.mts` writes and pins the two Horizons tables. The dataset ships on its paper's comparison figure: `preparation/published-comparison.json` names the figure in the pinned paper, `packages/bake/cli/published-comparison.mts` measures it into `evidence/published-comparison.json`, and `publishedComparison.ledgerEntry` names the included ledger entry; the registration verdict is reported, not a gate. [SPHERE survey photographs](sphere-survey-photographs.md) is the recipe: `packages/bake/cli/sphere-survey-setup.mts` builds and measures the dataset in scratch and `packages/bake/cli/sphere-survey-install.mts` writes it into the package | `observer-camera.test.mts`: the spin record against the IAU elements DAMIT publishes for the same model, the PCK model against Horizons sub-observer points for Jupiter and Saturn, and the two providers against each other for Pallas; `observer-cameras.test.mts`: every recipe states what its pinned inputs derive; `spin-record-reading.test.mts`: every released spin record reads one way against its published pole, apart from two disagreements the ledgers record; `published-comparison.test.mts`: bands, panels, arrows and the overlap measure on synthetic figures; `sphere-horizons.test.mts`: batching, row checks and pins; `sphere-survey/*.test.mts`: frame selection, listing names, label reading on the survey figures, the dataset settings every survey dataset shares, and README blocks read from the evidence; `report-registration.test.mts`: a dataset that ships on its comparison has evidence matching its record and an included ledger entry citing the paper |
| Three filters with controlled cameras | `controlled-shape-color` | Proteus and Hyperion `filter-color` | `bands` naming the three filters, and `frames` as band sets naming each set's red, green and blue photographs. Native filters/units and the shared color-display policy are required. No single-filter photometric model | None yet |
| ISIS2 orthographic image cubes | `isis2-orthographic` | Borrelly `micas` | Cube pins; no Sun geometry, so no photometry | `isis2-qube.oracle.test.mts` |
| Optical-interferometric visibilities with no image at all | `controlled-shape-camera` with `fits-oi-reconstruction`, on the planet route through the raster science kind `surface-observation` (`science.shape` names the reference sphere table, `science.dataset` the dataset) | Betelgeuse `matisse`: public VLT/MATISSE OIFITS merged by `packages/bake/src/objects/layers/observation/interferometry/matisse-continuum.ts` and reconstructed with the public SQUEEZE code at a pinned commit | The merged OIFITS, the reconstructed image and the SQUEEZE build and command as pinned inputs; a `reconstruction` block on the frame naming the visibilities' epoch, band and file; the computed camera | The fit of the image to the visibilities is `packages/bake/src/objects/layers/observation/interferometry/image-fit.ts` |
| A star whose authors deposited their reconstructed image | the `surface-observation` science kind with `fits-oi-reconstruction` frames pointing at the deposited FITS (CDS), one dataset per epoch with its own consumer group; nothing reconstructed here | CE Tauri `pionier-2016-11`, `pionier-2016-12` (Montargès et al. 2018, CDS J/A+A/614/A12) | Each image is fitted to the public OiDB visibilities with `packages/bake/src/objects/layers/observation/interferometry/oifits-concat.ts`, which pins its orientation | The public OiDB level-2 files are an automated calibration, so the fit proves epoch and orientation, not the authors' chi-squared |
| A placed star with only its shape | `neutral-shape` science kind on the emissive route (the interpreter returns transparent plates); `discoveryVisibility` hides a star without imagery from the map | Antares `shape` | `site/test/object-discovery.test.mts`; the ledger records the excluded image routes | The page opens from search; the star joins the map when an image can be cast |
| A published longitude/latitude grid of a surface property in another body frame | `npy-lonlat-grid` scientific format (`packages/bake/src/objects/raster/numpy/npy-lonlat-grid.ts`): the release's `.npy` arrays unchanged, nearest-node cells, and a `frameTransfer` record naming the grid's published spin state and the mesh's spin file; `additionalDatasetIds` lets the datasets share an alternative mesh | Psyche `thermal-inertia`, `dielectric-constant` (Cambioni et al. 2022 ALMA maps on the ADAM mesh) | `npy-lonlat-grid.oracle.test.mts` against numpy |
| An unresolved body with published flux densities in three infrared bands | `disc-integrated-band-color` science kind on the raster route: a `cssearth-disc-band-color@1` record (bands longest first, one zero-based range shared by the sibling bodies), `falseColor: true`, painted uniformly | HR 8799 b-e `color` (JWST/NIRCam F460M, F430M, F410M, Balmer et al. 2025) | `packages/bake/src/objects/layers/observation/disc-band-color.test.mts` |
| The limb of an imaged planet with an infrared color | `new-object --imaged-limb <id>...` puts `science.limbDarkening` on the band color: the H-band quadratic law of the Claret, Hauschildt & Witte (2012) PHOENIX grid at the planet's temperature and gravity, with its nodes kept as `photometry/claret-2012-h-quadratic.tsv`; the bake draws the limb plate from it. Below 1,500 K the law is computed with the PICASO toolchain from the model a paper fitted to the planet (a cloudy Sonora Diamondback or Exo-REM model, solved with four-term spherical harmonics, or a cloud-free Sonora Elf Owl model), transcribed in `photometry/atmosphere-fit.json`; with no usable fit the planet stays flat and its ledger says why. A self-luminous planet with no color takes the law on its gray shape, in the band its fit record names (`band`) | YSES 1 b `infrared` (1,727 K, log g 3.59, the table); HR 8799 b `color` (the Nasedkin et al. 2024 fit, in F430M) | `packages/telescope-cli/src/new-object/imaged/imaged-limb.test.mts` |
| An unresolved body with published whole-disc colors and albedo | `disc-integrated-color` science kind on the raster route: cited color record plus CIE 1931 and D65 tables, painted uniformly; discovery does not count it as imagery | Makemake `color`, Eris `color`; Haumea `color` on the shape-model route (`surfaces` list in `shape-model.json`); Ymir and Siarnaq `color` on the terrestrial route (a `shapeViews` entry with a `science` block) | `packages/bake/src/objects/color/disc-integrated-color.test.mts`, `packages/bake/src/objects/layers/terrestrial/shape-material.test.mts`, `site/test/object-discovery.test.mts` |
| A published illustrative model texture for a body with no imagery | `glb-base-color` science kind (`packages/bake/src/objects/layers/shape-model/glb-surface.ts`): the pinned GLB's base-color texture carried through its own UVs; the dataset id goes in `catalog.illustrationDatasets`, so discovery never counts it, and it is never the default dataset | Makemake, Eris, Haumea and 55 Cancri e `illustration` (NASA VTAD models) | `packages/bake/src/objects/layers/shape-model/glb-surface.test.mts`, `site/test/object-discovery.test.mts` |
| A published artist's global map for a planet with no imagery | `equirectangular-illustration` science kind (`packages/bake/src/objects/interpretation/interpret.ts`): a 2:1 map resized unchanged onto the sphere, left edge at 0°; `packages/bake/cli/illustration-dataset.mts` adds it to a hosted planet as a non-default dataset listed in `catalog.illustrationDatasets` | HD 189733 b, GJ 504 b, Kepler-452 b and TRAPPIST-1 b–h `illustration` (NASA Eyes on Exoplanets maps) | `src/platform/equirectangular-illustration.test.mts` |
| What is published about a body, or about every body of a class | `telescope leads OBJECT` and `telescope leads --class exoplanet` (`packages/telescope-cli/src/simulations/leads.mts`): DataCite's data releases and arXiv papers that name the body and speak of a measured phase curve or map, a measured eclipse, or a model, ranked with what each page opens on | The 2026-10-04 exoplanet sweep: 108 planets with a paper naming them in its title, eight of which became measured heat maps | `packages/telescope-cli/src/simulations/leads.test.mts` | A lead is not a dataset: the paper is read and its table transcribed |
| A rocky planet whose only measurement is an eclipse depth its paper calls a bare rock's | `new-object --rock-eclipse entries.json` (`packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.mts`) writes a `bare-rock-eclipse` dataset from the printed depth, the band's SVO filter curve and the BT-Settl spectrum nearest the star; labelled a model set by one measurement. Method: [a rock set by one eclipse depth](../../../../docs/eclipse-mapping.md#a-rock-set-by-one-eclipse-depth); a depth summed over a spectrograph names a released `throughput` table instead of a filter, the paper's own `radiusRatio` goes with its depth, and the paper's printed `dayside` temperature is the check (refused beyond two sigma) | `toi-1468b`, `ltt-3780b`, `lhs-1140c`, `gj-3929b`, `gj-1252b`; `trappist-1c` is the hand-made first | `packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.test.mts` | Refuses a verdict that is not a bare rock. A band that is no single SVO filter (MIRI LRS white light, NIRSpec) is not read |
| A hot giant with a measured dayside temperature and no map | `new-object --thermal <id>...` paints the black-body color at the temperature measured in eclipse: the archive's emission table, then the Spitzer eclipse catalogue of Deming et al. 2023 (CDS J/AJ/165/104) | HAT-P-1 b `thermal` (1,733 K at 3.6 µm) | `packages/telescope-cli/src/new-object/planet-glow.test.mts` | Under 1,000 K nothing glows; an orbit with e of 0.3 or more is left out |
| A hot giant nobody has measured | `new-object --expected-glow <id>...` paints the same color at the equilibrium temperature a paper prints, as the "Expected glow" dataset | HAT-P-14 b `thermal` (1,624 K, Southworth 2012) | `packages/telescope-cli/src/new-object/planet-glow.test.mts` | An estimate, said as one everywhere; only giants of 0.77 Jupiter radii or more, the population its test covers ([estimates](scientific-faithfulness.md#estimates)) |
| A measured day side that cannot be a glow (under 1,000 K, or an eccentric orbit) | `new-object --thermal` and `--thermal-entries` write the `measured-dayside` dataset (`packages/telescope-cli/src/new-object/thermal/dayside-dataset.mts`): the day hemisphere in false color at the printed temperature on the scale all such planets share, the night hemisphere blank | WASP-80 b `dayside` (888 K at 4.5 µm) | `packages/telescope-cli/src/new-object/planet-glow.test.mts` | No glow, no pattern; "at secondary eclipse" for an eccentric orbit, nothing past e 0.6 |
| A small hot planet of a red dwarf nobody has measured | `new-object --expected-glow` paints the bare-rock maximum from the star's temperature and a/R*, for planets like the nine rocks of Coy et al. 2025 | GJ 806 b `thermal` (1,204 K) | `packages/telescope-cli/src/new-object/planet-glow.test.mts` | An estimate; the archive's insolation is the check; rocks of hotter stars and sub-Neptunes are not covered |
| A published simulation of a named body | `telescope simulations OBJECT` lists the Zenodo records that name it (`packages/telescope-cli/src/simulations/simulations.mts`). `new-object --simulation entries.json` (`packages/telescope-cli/src/new-object/simulation/simulation-dataset.mts`) adds one from an entry written after reading the paper, as the default dataset where the body had only one color or the neutral shape: it checks the record's license, name and file, fetches by range the two parts of the file it reads (the header with the coordinates, and the selected grid) and writes a `terrestrial-scientific` dataset with `format: netcdf-lonlat-field` (`packages/bake/src/objects/raster/netcdf/`), labelled as a model with its scenario. An entry with `member` names a NetCDF-4 model file inside a ZIP release, kept whole and restored by a `zip-member` step, and may add `isobar` to read the field at one pressure. Conditions: [published simulations](scientific-faithfulness.md#published-simulations) | `trappist-1e` (ExoCAM surface temperature), `trappist-1d` (Generic PCM outgoing thermal radiation, from a 3.5 GB file), `wasp-94-a-b` (Met Office UM temperature at 1 millibar, from a NetCDF-4 file in a ZIP); WASP-103b's hand-made table is the earlier example | `packages/bake/src/objects/raster/netcdf/*.test.mts`, `packages/telescope-cli/src/simulations/simulations.test.mts`, `packages/telescope-cli/src/new-object/simulation/simulation-dataset.test.mts` | NetCDF-4 is read only in its plain kind: a chunked or compressed variable, or one inside a group, is refused by name, and the file is kept whole. In a classic release the variable's longitude and latitude must be its last two dimensions and its coordinates must not be record variables |
| A published simulation of a star's corona or wind, released as a three-dimensional grid | `packages/bake/authoring/eps-eridani-corona/author.mts`: `tecplot-binary.mts` reads a Tecplot binary (.plt) solution by byte range, `simulation.mts` paints its cells onto a cube about the star, and the gas density becomes a volume bank attached to the star (`attachedTo`), one dataset step a magnetic map. Brightness goes through the radial filter coronagraph pictures use (`filteredValue`): proportional to density at each distance, with only the fall-off with distance compressed. When a release holds runs disturbed by a modelled event, `eruption-share.mts` measures each run against the median of the runs and the least disturbed one is drawn. Conditions: [published simulations](scientific-faithfulness.md#published-simulations) | `eps-eridani-corona` (three magnetic maps of Ó Fionnagáin et al. 2022, with a Parker wind from the measured mass loss beside them) | `packages/bake/authoring/eps-eridani-corona/*.test.mts` | Brick zones in block packing only. Where only the inclination is published, the axis direction on the sky and the rotation phase are conventions and the dataset says so |
| A planet of another star with a published longitude-latitude map | Astronomy record `classification: exoplanet` with a `hostedOrbit` block around a placed star (`packages/astronomy/src/hostedOrbits.ts`), rotation `cssearth-synchronous-rotation@1` (`packages/bake/src/objects/scene/authored-rotation.ts`), and a `terrestrial-scientific` dataset with `format: npy-dictionary-map` on the lit route, as every planet with a map is drawn (`packages/bake/src/objects/raster/numpy/npy-pickle.ts`, `tar-member.mts`; `new-object --star-lit <id>...` moves a planet built self-luminous to the lit route, `packages/telescope-cli/src/new-object/map/star-lit.mts`); paint the atlas from `outputLongitudeOrigin: -90` | WASP-43b `temperature`: Challener et al. (2024) JWST NIRSpec eclipse map, Zenodo tar read in place | `packages/bake/src/objects/raster/eclipse-map/phase-curve.ts` turns the map with the package's orbit and rotation; `default-view.test.mts` pins the substellar view | Photometry cannot tell north from south; the orbit's node on the sky is a display convention |
| A wide companion star whose orbit is not measured | Its own Gaia placement with `boundTo` and a `sources.binary` citation of the measurement that binds it (`packages/astronomy/cli/lib/generator-records.mts`); no orbit is drawn, and preparation carries the pair's centre of mass into the world context. A LOFTI fit (`packages/bake/authoring/hd-189733-companion/lofti-fit.py`) may be kept as evidence only: the candidate-orbit renderer was removed because the accepted orbits span a factor of ten in size | HD 189733 B | No dedicated test | The companion lies on no orbit |
| A directly imaged planet whose paper publishes its orbit's inputs but not one orbit | `packages/telescope-cli/src/new-object/hosted-orbits/orbitize-fit.py` reruns orbitize! (the papers' own tool) on the paper's measurements, priors and sampler (a `fit.json` beside the measurements, corrections such as astrometric jitter or the shift to a pair's centre of mass declared there); the maximum of orbitize!'s posterior, refined with Nelder-Mead from many starts (`--refine`), becomes the `hostedOrbit`, kept at its fitted angular size and placed at the Gaia distance. A planet around a pair is fitted about the pair's centre of mass (`centreOfMass` in `fit.json`) and drawn around the primary. The drawn orbit uses the gravitational parameter the recorded period and size imply (`prepare-solar-geometry.mts`), so a pair-mass fit draws correctly around one star. Short-arc orbits are drawn as one of the orbits the measurements allow; the README gives the published range | GQ Lup b (Venkatesan et al. 2025); VHS 1256-1257 b, DH Tau b, ROXs 42B b | `packages/astronomy/src/hostedOrbits.test.ts` puts each planet on the paper's measured positions | The medians printed by the run are compared with the paper's table before the sample is used |
| The second star of a close pair that a planet orbits | Astronomy record `classification: star` with a `hostedOrbit` around the placed primary (Gaia does not resolve the pair); scaffolded by `packages/telescope-cli/src/new-object/new-hosted-planet.mts --self-luminous`, which keeps the star class and a temperature catalogue color | VHS 1256-1257 B (Dupuy et al. 2023), ROXs 42B B (Inglis et al. 2026) | `hostedOrbits.test.ts` reproduces each paper's measured positions of B around A | Posterior medians of a bimodal (omega, Omega) posterior may mix modes; the measured positions decide |
| A star with no spectrum or catalogue temperature of its own | `stellar-photometric-color` with `spectrum: planck` and `temperature.published` (kelvin, bounds, citation with URL) instead of a catalogue row (`packages/bake/src/objects/stellar/stellar-photometric-color.ts`) | The six stars of VHS 1256-1257, GQ Lup, DH Tau and ROXs 42B | `stellar-photometric-color.test.mts` | No limb darkening unless a law is cited |
| A placed star whose spin axis is measured against its planet's orbit | `cssearth-measured-obliquity-pole@1` (projected obliquity, stellar inclination, true obliquity checked against them, equatorial period; `packages/bake/src/objects/scene/authored-rotation.ts`) or `cssearth-orbit-aligned-pole@1` when only an aligned projected angle is measured | HD 189733 A (Cristo et al. 2024); WASP-43 (aligned) | `packages/bake/src/objects/scene/authored-rotation.test.mts` | The axis's position angle on the sky follows the orbit's display convention |
| An eclipse map deposited without grid arrays or covering unobserved longitudes | `npy-dictionary-map` with `gridLayout: pixel-centres` and `visibleLongitudes` (ThERESA's rule from the deposit's own observation times) | HD 189733b `temperature` (Lally et al. 2025, output_E.npy) | `packages/bake/src/objects/raster/numpy/npy-pickle.test.mts` | Unobserved columns are missing data, as in the authors' figures |
| An eclipse map whose authors released the map file | `new-object --published-map entries.json` (`packages/telescope-cli/src/new-object/map/published-map-dataset.mts`) writes an `npy-dictionary-map` dataset from the Zenodo record: a `.npy` dictionary or a bare pickle (`container: pickle`), the longitudes the paper shows (`shownLongitudes`), and the paper's printed hot-spot longitude as the check that the grid is read as drawn | WASP-17 b `temperature` (Valentine et al. 2024, tmap.pkl) | `packages/telescope-cli/src/new-object/map/published-map-dataset.test.mts` | A release without a license that allows reuse, or a hottest cell away from the printed hot spot, is refused |
| A placed star with no measured rotation axis | `cssearth-display-orientation@1` rotation record with the pole set to sky north in the plane of the sky and `displayMeridianDegrees` facing the Earth; star record `presentationUp: display-axis` (`packages/astronomy/src/stars.ts`, read by `packages/bake/cli/prepare-solar-geometry.mts`) so the presentation frame and the camera orbit use that axis instead of the ecliptic pole | π¹ Gruis `pionier`: Paladini's image-ready PIONIER OIFITS from the OiDB read as is, `packages/bake/src/objects/layers/observation/interferometry/oifits-rows.ts` for the per-channel fit | — | The axis is a labelled convention; a star far from the ecliptic would otherwise never face its sub-Earth point |
| A default camera angle, a body orientation or an off-limb plate turn | Nothing authored: `packages/bake/src/objects/scene/default-camera.ts` derives the camera (photograph frames, a self-luminous body facing the Sun, or the lit design pose); the world-navigation stage solves the system node so the drawn body is in the ecliptic presentation frame; `prepareSkyNorthScreenAngleDegrees` turns the plate. Recipes that state `initialScenePitchDegrees`, `defaultControlYawDegrees` or `offLimb.rotationDegrees` are refused | Amalthea (photo mosaic), Betelgeuse (star and plate), Callisto (lit pose) | `packages/bake/src/objects/default-view/default-view.ts` measures the result through the shared camera math (`@cssearth/engine`, `@cssearth/objects`) | The world-navigation stage owns the pose: `node site/build/prepare/prepare-object-json.mts --keep-bindings` re-applies a rule change to every object in seconds; the five planet lanes bake lighting at the rule's pitch and re-bake only when it changes |
| The default camera of a photograph dataset on the planet route | `packages/bake/src/objects/default-view/default-view.ts` (`assertDefaultViewFacesDataset`, run by `prepare-authored` for every `surface-observation` dataset) | Betelgeuse `default-view.test.mts` | The runtime's scene matrix and `worldCameraFromPresentation` give the sub-camera point and the screen angle of any direction without a browser | Preparation refuses a default view more than 25 degrees from the dataset's sub-observer point; the test pins the browser-measured angles |

For scientific charts, start with the [recipe catalog](../../../../docs/chart-recipes.md).
Reuse its six prepared families and shared axes, typography and palette. Give
every axis a quantity, units and numeric ticks. Standalone curves and measured
points are neutral off-white; reserve color for multiple series and annotations.
Separate curve keys from shaded regions. Only draw
uncertainty when the source supplies it. Inspect the mounted panel at desktop
and mobile widths, including labels, legends and the image's intrinsic size.

For deposited temperature–pressure retrievals, use the
[reusable chart recipe](../../../../docs/retrieved-profile-charts.md). The shared chart step accepts
`kind: retrieved-profile` through `packages/bake/src/objects/charts/retrieved-profile.ts`.
WASP-18b's `source/content/charts.json` binds each table's native pressure unit,
column order, row count and absolute credible bounds. The preparer keeps native
samples within the displayed range, interpolates only boundary crossings in
log-pressure, refuses extrapolation or clipped intervals, and emits one SVG
image for the shared panel. Check independent values against the published
figure as well as parser invariants; label these as model retrievals and state
which pressures the observation constrains. `retrieved-profile.test.mts` owns
those checks. A spectrum or phase curve alone does not establish local profiles.

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
`packages/bake/src/photometry/README.md`), and [photometric models](photometric-models.md)
lists which bodies have one. Kernels that serve several bodies of one mission
live in a kernel bank under `src/spice/<mission>/`: add, restore and verify them
with `node packages/bake/cli/kernel-bank.mts`, and name the bank with `spice.kernelSet`.

A star other than the Sun is a placed body. `packages/astronomy` carries its
catalogue astrometry (`star` record: ICRS position and epoch, distance, proper
motion, radial velocity, each with its source), `packages/bake/cli/prepare-solar-geometry.mts`
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
OSIRIS example below was inspected in PR #49. Check the selected checkout
for availability; this reference does not establish merge or deployment status.

| Capability | Owner relative to the repository |
| --- | --- |
| Observation pins, quality policy, photometry and transfer limits | `src/objects/comet-67p/source/preparation/terrestrial.json` and `acquisition.json` in the same directory |
| OSIRIS decoding, companion identity and quality flags | `packages/bake/src/objects/layers/terrestrial/missions/osiris-geo.ts` |
| Projective fit with a disjoint holdout, footprint sampling, source-mesh correspondence and visibility | `packages/bake/src/objects/layers/terrestrial/surface-observations/`, described in its [README](../../../../packages/bake/src/objects/layers/terrestrial/surface-observations/README.md) |
| Deterministic surface samples, bounded overlap gains and observation selection | `packages/bake/src/objects/layers/terrestrial/surface-observations/levels.ts` |
| Atlas baking and lossless observation-index output | `packages/bake/src/objects/layers/terrestrial/radial/radial-materials.ts` |
| Selection/level regressions and prepared provenance checks | `packages/bake/src/objects/layers/terrestrial/surface-observations/levels.test.mts` |
| Worked method, limitations and measured evidence | [67P source and evidence account](../../../../src/objects/comet-67p/README.md) |

Inspect the actual recipe/schema before reuse. The OSIRIS decoder and quality
bits are instrument-specific; source identity, geometry qualification and
provenance are transferable requirements. 67P's distances, angles, sample counts,
photometric model and gain limits are evidence for that dataset, not defaults.

Archives that ship an image with its geometric backplanes as one PDS4 cube use
the same pipeline through `format: "pds4-geometry-cube"`: the recipe's `cube` block
names the label planes that carry the image, the X/Y/Z intercepts and the
angles, the collection, target, observing system and DSK to bind, and optional
FITS header expectations. `packages/bake/src/objects/layers/terrestrial/missions/pds4-geometry-cube.ts`
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
plane and its flag values are read. `@cssearth/spice` (`packages/spice`) is the strict-TypeScript
kernel subset (DAF, SPK types 1, 2, 3, 5, 8, 9 and 13, CK types 1 to 3, text
kernels, leap seconds, SCLK, PCK pole models, frame classes 2 to 6, light time
and stellar aberration) and its `spiceCamera` (`packages/spice/src/camera.ts`) assembles the camera;
`packages/bake/src/objects/layers/terrestrial/missions/spice-camera.ts` turns it into the same
`cssearth-archived-camera@1` closure the OSIRIS and L'LORRI formats use, and
`castSourceRays` derives per-pixel geometry from the full source mesh. The
route was validated end to end against Dimorphos's DRACO backplanes: 0.5 px
against the archive's own intercepts, the constant offset explained by kernel
versions.
Tethys's Cassini ISS dataset is the first dataset on this route. It reads its kernels
from the shared Cassini bank, decodes a VICAR image, and evaluates the camera at
mid-exposure from the clock counts in the PDS3 label (`image.format:
"vicar-pds3"`, `clock.start` and `clock.stop`). `IAU_<body>` frames resolve
without a frame kernel, as they do in SPICE. A recipe may constrain separation
among bilinear image contributors. This is distinct from correspondence between
the displayed mesh and the source mesh; applying a contributor-distance limit to
that correspondence can create false coverage holes. Use the current
[transfer policy](../../../../packages/bake/src/objects/layers/terrestrial/surface-observations/README.md#route-policy)
and [contributor limits](../../../../packages/bake/src/objects/layers/terrestrial/surface-observations/README.md#transfer-limits)
rather than copying a distance from another body.

Archived and kernel pointing carries the archive's error: a fraction of a pixel
for a solution tuned to the images, tens of pixels for a reconstructed C-kernel.
A `spice-camera` or `osiris-camera` recipe may declare `limbRefinement: { method:
"mesh-limb", maximumCorrectionDegrees, maximumResidualPixels, minimumControls,
searchPixels?, maximumControls?, minimumSharpness?, threshold? }` and
`packages/bake/src/objects/layers/terrestrial/registration/limb-refinement.ts` then fits one rotation of
the camera to the lit limb of the retained mesh before geometry is derived:
edges are the sub-pixel coverage crossings of the body against background
connected to space, sharp enough not to be terminator; each edge is matched to
the mesh limb along its normal; terminator edges are recognised because the
limb they reach faces away from the Sun; the match window grows until the
count plateaus; a damped least-squares fit with a robust cut follows; and the
holdout half of the edges must land within the declared residual budget, with
the correction below its bound, or preparation refuses the frame. The report
(correction, residuals before and after, matched fractions) lands in the dataset
metadata. Range, focal length and Sun direction are never changed.
Measured against the DRACO backplanes, the kernel camera stayed within 0.6 px
of the archive, and cameras pushed 30 and 150 px away returned to 0.24 and
0.55 px.

For an initial comparison of published planetocentric coordinates with native
image picks, `packages/bake/cli/check-projected-controls.mts` replays
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
pipeline computed so a test can compare. Each owning package holds its oracles with a
pinned Python environment (`node packages/core/src/node/oracle/setup.mts`, `packages/core/src/node/oracle/requirements.txt`),
and each writes a fixture beside its owning code that names its versions, input
paths and byte counts. Existing decoder references include
SpiceyPy for `@cssearth/spice` (a microsecond in time, a millimetre in position, a
nanoradian in rotation); pds4_tools for the PDS4 geometry cube; pvl and numpy for
the OSIRIS geometry, OSIRIS reflectance, AMICA and ISIS2 readers; astropy for
the L'LORRI reader and its TAN-SIP distortion and for the three encounter FITS
layouts. Comparing tests sit beside each reader. Missing inputs can skip source-dependent cases. A new scientific
source-format parser, decoder or interpretation algorithm needs independent reference evidence.
Use the existing pinned oracle framework for new decoding behavior; do not use
the implementation's own output as its expected result.
Reusing validated readers or composing an existing route needs focused consumer
checks; it does not automatically require another oracle environment or regenerated
fixtures. Camera controls still need their geometric checks. Regenerate a fixture
only when its tool or inputs change, and say so in the PR. ALE and usgscsm (pixel models and
distortion) need conda and arrive with the first Cassini ISS dataset. ISIS's
photometric models are checked against the truth files of their unit tests,
which need no ISIS install. See `packages/core/src/node/oracle/README.md`.

For SUM/INFO image-to-shape investigations, use the optional
[native SBMT preparation oracle](../../../../packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/README.md).
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
| Build shared tool bundles when needed | `pnpm build:preparation` |
| Install already published prepared files | `pnpm setup:assets --object=<id>` |
| Restore missing declared source files | `node packages/bake/cli/object-operations.mts acquire <id>` |
| Check declared source-file coverage without acquiring | `node packages/bake/cli/object-operations.mts acquire <id> --verify-only`; this does not verify source digests |
| Prepare selected objects and the shared steps | `pnpm prepare:objects -- --object=<id>` |
| Create the oracle environment and regenerate oracle fixtures | `node packages/core/src/node/oracle/setup.mts`, then `node packages/core/src/node/oracle/run.mts [group/name ...]` |
| Invoke authored preparation directly | `node site/build/prepare/prepare-authored.ts <id> --write` |
| Prepare one authored object end to end, resumable by step | `node packages/bake/cli/prepare-object.mts <id> [--from <step>] [--reuse-images]` (a paged-ellipsoid or raster body redraws only its lighting and atmosphere banks by default when nothing else changed; `prepare-authored.ts <id> --write --full` bakes everything; `--reuse-images` forces the redraw-only run and stops after the prepare step): stale install and builds, reader text budgets and the Sun's installed files, catalogue, title, geometry, write mode, discovery, source records, page, text, markers, world context, provenance for this object only |
| Say which build a run would read stale | `node packages/bake/cli/check-stale-builds.mts` |
| Declare a new input or document | Update `source/manifest.json` and its acquisition recipe with the path and source binding; the old document-pinning helper is retired |
| Re-prepare only the content record after a credit or provenance edit | `node site/build/prepare/refresh-content.mts <id> ...` (refuses if any other prepared file would change) |
| Find what the literature published for a resolved-star candidate | `node packages/bake/cli/star-candidates.mts "<SIMBAD identifier>"`: OiDB calibration levels, VizieR image deposits from the star's own papers, and the route that worked for the placed stars; archive leads (`packages/bake/src/objects/candidates/archive-search.ts`) from the JMDC measured diameter, ALMA projects with beams across the disc, ESO interferometer and adaptive-optics frames, HST and JWST imaging, and DataCite deposits of the star's papers |
| Image a star from one raw season and decide whether it may be cast | `node packages/telescope-cli/src/archives/interferometry/image-star.mts <season dir> <work> [--raw <dir>]`: a `seasons/<id>/season.json` pin; calibrates, selects, fits the disc, reconstructs the season, halves and spotless twins with SQUEEZE, writes `verdict.json` and compares with the author's file and image; see [Interferometric imaging](../../../../docs/interferometric-imaging.md#one-command-per-star) |
| Install a pinned interferometry toolchain (SQUEEZE, ROTIR, ESO PIONIER, AMBER, GRAVITY, MATISSE) | `node packages/telescope-cli/src/archives/interferometry/toolchain.mts install <id>`: `toolchains.json` pins, installs under `output/toolchains/` |
| Calibrate PIONIER visibilities from raw frames | `node packages/telescope-cli/src/archives/interferometry/calibrate-pionier.mts <work> --target <OBJECT> --from <ISO> --to <ISO>`: plan from the ESO raw table, esorex and pndrs; see [Interferometric imaging](../../../../docs/interferometric-imaging.md) |
| Calibrate AMBER visibilities from raw frames | `node packages/telescope-cli/src/archives/interferometry/calibrate-amber.mts <work> --target <OBJECT> --from <ISO> --to <ISO> --calibrator <NAME>=<mas>:<error>`: amdlib chain, per-baseline frame selection, CO wavelengths |
| Calibrate a GRAVITY or MATISSE exposure from raw frames | `node packages/telescope-cli/src/archives/interferometry/calibrate-gravity.mts <science dp_id> <work>` or `calibrate-matisse.mts`: follows the archive's calselector tree, one science and one calibrator exposure |
| Select channels, nights, error floors or a wavelength scale before a reconstruction | `node packages/telescope-cli/src/archives/interferometry/oifits-select.mts <in> <out> [--window min:max] [--mjd min:max] [--half even\|odd] [--error-floor <fraction>:<degrees>[:<minimum>]] [--wavelength-scale f]` |
| Reconstruct a surface on a sphere | `node packages/telescope-cli/src/archives/interferometry/surface-reconstruction.mts <oifits> <dir> --diameter-mas <d>`: ROTIR on HEALPix, writes the map and its sky projection |
| Decide whether a reconstruction may be cast | `node packages/telescope-cli/src/archives/interferometry/spotless-disc.mts simulate ...`, reconstruct both, then `compare ... --chi2 <vis2>:<closure> --halves-correlation <r>`: fit within 3, spots at least twice the spotless disc's, and halves (`oifits-select.mts --half even|odd`, `spotless-disc.mts reproduce`) correlating at 0.5 |
| Cast a sphere reconstruction onto a dataset | `node packages/telescope-cli/src/archives/interferometry/surface-dataset.mts <surface-grid.fits> <map.fits>`: body longitudes, recipe `outputLongitudeOrigin: -90` |
| Install the pinned Eureka! environment for raw JWST reductions | `node packages/telescope-cli/src/archives/jwst/toolchain.mts install`: micromamba Python 3.11 plus `requirements.lock` and one source patch, under `output/toolchains/eureka` |
| Subtract a star from JWST NIRCam coronagraphy the way a paper did | `node packages/telescope-cli/src/archives/jwst/toolchain.mts install klip` (spaceKLIP on the paper's jwst version and CRDS context, `klip/toolchain.json`), then `node packages/telescope-cli/src/archives/jwst/klip/reduce.mts <program> <band> <work> --raw <dir>` over a pinned `jwst/programs/<id>.json` naming the raw exposures, science and reference roles and every published setting |
| Reduce a JWST time series from raw exposures | `node packages/telescope-cli/src/archives/jwst/reduce-tso.mts packages/telescope-cli/src/archives/jwst/programs/<id> <work> [--raw <dir>]`: Eureka! stages 1-4 in memory-safe batches, light curves exported to CSV with the author's deposit; then `compare-light-curves.mts`; see [Eclipse mapping](../../../../docs/eclipse-mapping.md) |
| Find whether an archive holds finer frames than a body ships | `node packages/bake/cli/imagery-candidates.mts [<id> ...] [--minimum-pixels 50] [--json]`: OPUS's finest body-centre image resolution per covered body against the finest frame its photograph datasets cast, with pixels across and phase; advisory, since a frame still needs a camera, registration and reuse terms. `--archives <id> ...` searches ALMA, ESO raw frames and MAST under the body's catalogue name and SBDB designations, and DataCite for deposits of the papers it already cites |
| Set up a VLT/SPHERE survey body's photograph dataset and measure it against the survey figure | `node packages/bake/cli/sphere-survey-setup.mts <id>` in scratch, then `node packages/bake/cli/sphere-survey-install.mts <id>` into the package; see [SPHERE survey photographs](sphere-survey-photographs.md) |
| Write a ground-based dataset's two Horizons tables | `node packages/bake/cli/sphere-horizons.mts <id> [--write]`: Paranal rows at each frame's exposure start and heliocentric vectors one light time earlier, asked in batches of 25 and declared in the manifest; a table the manifest does not name yet is declared for `node site/build/prepare/author-source-records.mts` |
| Measure a ground-based dataset against its paper's comparison figure | `node packages/bake/cli/published-comparison.mts <id> [--write]`: reads the figure from the pinned PDF (`packages/bake/src/sources/pdf-image.ts`), writes `evidence/published-comparison.json` and its image; a new record's zero pixel digest is adopted on the first `--write` |
| Generate a placed star, its planets and companion stars | `pnpm telescope new-object <spec.json>` (also `node packages/telescope-cli/src/new-object/new-object-cli.mts --spec <spec.json>`; format in `packages/telescope-cli/src/new-object/spec.mts`). SIMBAD, through the telescope's resolver, names the star and gives its Gaia DR3 source; placement from the Gaia row. Color: the first spectrum that reads, in the order STIS NGSL, Gaia XP (the ARI Heidelberg mirror when ESA's DataLink is down), Pulkovo, Kiehling, Kharitonov, Burnashev part 2, with the next as the cross-check, else Planck at the cited temperature; coverage gaps declared. Limb: Claret & Bloemen (2011) ATLAS V, else Claret (2017) PHOENIX, else none with the reason. Orbits: a whereistheplanet posterior picked by `posterior-pick.py`, one paper's NASA Exoplanet Archive `ps` row, or cited elements. Source records are written or reused by identity. Only prose is left marked `TODO(new-object)`, then `prepare-object`. The shape-only scaffold (`node packages/telescope-cli/src/new-object/new-object-cli.mts <id> --name ...`) remains for a black hole. `packages/telescope-cli/src/new-object/new-object.test.mts` reproduces GJ 504 b's shipped orbit from its posterior pick and checks the route choice, gaps and archive rows on fixtures |
| Restore selected-body sources before baking | `node packages/bake/cli/restore-source-inputs.mts --object=<id>`, then `pnpm prepare:objects --object=<id>` |
| Build the site and assemble declared runtime files | `pnpm build` |

Default acquisition restores missing inputs through `source/preparation/acquisition.json`.
`packages/bake/cli/restore-source-inputs.mts` selects the shared acquisition route;
source-manifest coverage and path checks do not compare a stored digest.
`pnpm setup:assets` separately installs published runtime bytes against their
inventories. Preserve source identity and scientific interpretation without
reintroducing the removed manifest-pin layer.

`packages/bake/cli/run-implemented-objects.mts` discovers registered scene objects for
preparation and assembly. The old per-body test directories and planet-test alias
are retired. `pnpm test` runs packages, renderer, native tests, the preparation
subset and lab checks; use the affected suite or direct test files for a focused
change. The shared runtime-package test exercises registered object packages.

`site/journeys/rendered-page.test.mts` reads an existing build and checks that the
information-tab rules live in the scene head. It does not build every object or test
interaction, raster appearance or line wrapping. The old Playwright conformance
profiles are retired; inspect changed browser views and interactions as required
by [qualification](qualification.md). Report unavailable assets and skipped tests
separately from executed checks.

Shared polar, lighting, coverage, atmosphere and interior raster operators are internal to
`packages/bake/src/baking/`; shared surface patches are internal to
`packages/bake/src/surface-geometry/`. Objects supplies format contracts, not these algorithms.
