---
name: celestial-skill
description: "Create, repair, and qualify source-backed celestial body packages for cssEarth through its generic object contract. Use for planets, moons, dwarf planets, asteroids, stars, and unfinished body packages. Excludes general astronomy questions and unrelated application refactors."
---

# Celestial Skill

Maintain this skill in the repository. Read the relevant sections of the selected
checkout's [provenance and documentation contract](../../../docs/provenance/CONTRACT.md).
For body data work, inspect the target's README, NOTICE and manifests. For a prose
correction, inspect the affected claim and its source rather than every body record.
The contract combines PDS4 1.26.0 provenance guidance with ISO 24495-1:2023
plain-language principles for our docs and evidence.
Use its pinned references; add body-specific facts without another report format.
This skill explains how to prepare and check a body. Update affected guidance in
the same PR when a preparation change alters its documented routes or checks;
implementation-only changes do not require a skill edit.
Installed copies should follow this version.

Use the [root source and delivery policy](../../../AGENTS.md#sources-and-prepared-delivery):
tracked manifests, descriptors and recipes name source files by path without
file-stability hashes. Preserve product versions and acquisition routes. Runtime
inventories identify published bytes; original evidence and untracked result
receipts retain their own hashes. A source-coverage check is not digest verification.

Build a body whose appearance is supported by its sources and whose behavior
comes from cssEarth's shared application. Follow this workflow for a new body;
for a repair, enter at the affected stage and reuse valid work already done.
Research and review requests do not imply implementation or publication.

## Enter at the requested work

Use the selected checkout's skill and contracts; an installed copy or historical
report may describe an older pipeline. Read only the references needed for the
changed capability. The stages below are not a checklist to rerun for every task.

| Request | Starting point and completion boundary |
| --- | --- |
| Documentation or credit correction | Check the cited spelling/fact and affected records; finish with the corrected prose and links. Unchanged sources and assets need no preparation. |
| Research, viability or next-PR proposal | Read current PR state and relevant ledgers, then investigate the missing facts. Distinguish examined evidence from remaining possibilities; do not implement or qualify a whole body merely to recommend work. |
| Repair an existing view or refresh its detail | Reproduce the defect, trace its source/recipe, and reuse valid registration, geometry and interaction evidence. Prepare the affected assets and inspect their changed appearance. |
| Add a body or selected dataset | Survey the relevant sources, choose the supported presentation, and deliver the selected view end to end. Additional interesting datasets remain recorded opportunities. |
| Add a shared preparation capability | Establish the missing source interpretation, extend the shared owner within the authorized scope, and check that interpretation and its consumers. An offline decoder is not a runtime change. |
| Repair findings from a catalog review | Reuse the audit and ledgers, check their revisions and affected inputs, and repair the demonstrated defects. Refresh inventory only for changed membership or missing coverage. |

Choose by the actual quantity as well: a scalar map, shape-only view or metadata
repair does not require photographic camera reconstruction. A diagnostic needs
the source/tool checks supporting its claim, not delivery checks for unchanged
runtime assets. Use the [qualification change table](references/qualification.md#check-what-changed)
when implementation or delivery changes.

## Shapes belong to datasets

Different datasets of the same body may use different source-backed shape
models. Pair each dataset with the mesh and coordinate system that support its
observations; sharing a body does not require sharing one mesh. Prefer the
matching published model over forcing imagery onto an incompatible shape.
Use existing prepared-model selection while keeping one active object scene,
only the selected model visible, and the shared renderer, camera and shell.
Bind observation preparation to that selected model as well: camera validation,
surface sampling, visibility, thumbnails and evidence must use the same mesh
as the dataset's triangle atlas. Prefer archived per-pixel geometry products
(the [registered mosaic guidance](references/registered-photographic-mosaics.md)
and the geometry-cube route in the [implementation map](references/implementation-map.md#registered-photographic-mosaics))
over pointing files whose pixel conventions the archive does not state.
A restriction on renderer changes does not by itself freeze prepared geometry;
respect explicit geometry or topology restrictions, including the persisted
[existing-moon upgrade scope](#scope-for-existing-moon-upgrades) below.
Explain meaningful model differences beside the dataset and qualify registration,
coverage and picking against the selected mesh. The [implementation map](references/implementation-map.md)
locates the existing support for alternative models.

For shape-only alternatives, bind each `shapeViews` entry to its selected
`radialTerrain` source as well. Verify that generated surface provenance names
that mesh, rather than reusing the default mesh's source for every dataset.

When changing places, landmarks or their discovery behavior, read
[surface places](references/surface-places.md) for source-frame binding and
label checks. Unchanged labels do not require a new discovery audit.

## Scope for existing moon upgrades

For Moons-owner follow-up proposals and PRs, keep existing body geometry,
retained scene topology, renderer, camera, navigation and shared shell fixed.
This boundary persists until the user explicitly changes it. Requests to be
ambitious, propose the next PR or proceed do not reopen that scope.

Do not propose or implement terrain displacement, sphere-to-mesh conversion,
mesh refinement or another geometry change under this scope. Using an existing
mesh rendering path or generating the geometry offline does not make such a
change acceptable. Apply the shape and mesh guidance below only when creating
a new body or when geometry work is explicitly in scope.

Make substantial advances through source-backed surface data: better imagery,
measured coverage, registration, photometric corrections or useful scientific
surface datasets. Prepare them through the existing object contract and retain
the fixed geometry and shared behavior. If a candidate requires crossing that
boundary, choose an in-scope outcome instead of repackaging the geometry change.

## 1. Inspect the sources and the working context

Confirm the target body, selected checkout, current `AGENTS.md`, branch and dirty
work. Respect the user's chosen server and port; verify that it serves the
intended changes. When none is designated, start one task-owned server if needed.
If isolation is needed, keep unrelated changes and servers intact; do not
silently validate a different checkout or accumulate servers on new ports.

Inspect available declared inputs before downloading alternatives. Before
finalizing a new body's lenses or expanding its views, make a brief source
survey beyond the first usable texture. Use the
[source directory](references/source-directory.md) to choose concrete archives
for the target and product: mission images and geometry, mapped surfaces,
radar or optical shape models, paper tables, and research-code inputs.
Search those relevant sources for better-resolution, registered or
photometrically corrected imagery and useful complementary products, such as
elevation, geology or composition. The directory also gives the public Git-history
route when a paper's input model is missing from a repository's current files.
Follow promising citations to the actual release; a display-texture catalog or
press-image search alone does not establish what datasets exist.

For photographic surfaces, choose the investigation route from the available
product before choosing a tool: a producer map, a mapped paper figure, an image
with archived surface geometry, or an unmapped photograph. Read
[photographic investigation](references/photographic-investigation.md) for each
route's evidence requirements and how to reassess a stalled method. A usable
controlled map does not require reconstructing its original cameras; it still
requires a documented frame, coverage and compatibility with the selected mesh.

For unmapped photograph-to-shape work, inspect the selected shape release as a
bundle before deriving a camera or looking for a replacement model. Read its labels,
file inventory and linked methods for companion image-geometry tables,
reconstructed pointing, control points, backplanes and detector-quality files.
Compare their observation IDs and model frame with the image headers; headers
may retain preliminary geometry superseded by the shape reconstruction.
Read kernel comments before accepting a body frame: a mission-hosted file can
retain placeholder pole coordinates or a pre-encounter rotation period. A
trajectory correction does not also establish the shape's prime meridian or
rotational phase. Keep these questions separate in the qualification evidence.
Establish sample/line order, pixel origin, aspect ratio, flips and units, then
inspect one native-pixel projection before fitting or baking. Read the product
with this repository's own readers: [`tools/fits/fits.mts`](../../../tools/fits/fits.mts)
for FITS, [`tools/fits/fits-sky.mts`](../../../tools/fits/fits-sky.mts) for which way a sky
image faces and for resampling a rotated one, and [`tools/spice/`](../../../tools/spice) for kernels. Both are
self-contained and run under plain Node, without installed packages or a
prepared checkout, so an unbuilt worktree is not a reason to write a scratch
decoder in another language. A scratch reader is untested, it can invert an
axis or a sign without saying so, and it is not the owner that the preparation
would use, so what it appears to establish has to be established again. Follow the
[source investigation sequence](references/registered-photographic-mosaics.md#inspect-the-release-before-reconstructing-geometry)
for conflicting or undocumented conventions. Record the selected companion and
any remaining inference in the existing recipe and body README.

Blank body-fixed convenience fields in an image header do not establish that
PDS lacks geometry. Inspect the mission SPICE release, including reconstructed
ephemerides, pointing, instrument and body-orientation kernels. Distinguish
active kernel assignments from commented or rejected alternatives, and match
receive time, target emission time and aberration conventions to the image.
Recover and verify the available archive inputs before declaring a source gap.

Search the relevant papers explicitly as well as the data archives. Inspect
full text, tables, figures, appendices and supplementary files: a usable map,
radius table, mesh, camera solution or registration controls may be published
there without a separate dataset download. Follow authoritative open-access or author-repository
copies when available. Match the paper's model version, coordinates, units and
observation identifiers to the selected inputs before using its numbers.
Record any transcription or digitization and check it against the published
table or figure. A paper's availability does not establish image or data reuse
rights; unresolved access remains unresolved evidence, not proof of absence.

Read the object's investigation ledger (`investigations.json`) before searching.
Reopen an excluded, unresolved or deferred entry only when its `revisitWhen`
condition is met, and say which. Record each examined source, route, lens or
frame there once, including failed trials: status, finding, evidence pinned to a
commit or pull request, and what would reopen it. The body README explains the
selected sources and links the ledger instead of repeating the survey.
Compare detail, registration, coverage and reuse terms before choosing. A better
mosaic can replace a weaker one without becoming a duplicate lens. Missing
metadata or a failed download leaves a candidate unresolved; it is not evidence
that the dataset does not exist. Respect explicit user exclusions and scope.
Stop the source survey once the promising candidates have a disposition; this
does not finish an authorized implementation. A failed method does not exclude
every route for its source. Record what failed, distinguish missing information
from missing tooling, and retain the next useful check in the existing ledger;
see [reassessing a stalled method](references/photographic-investigation.md#when-a-method-stalls).
Do not build an exhaustive catalog or repeat the survey for an unrelated repair.

Use the contract's [reference retention rules](../../../docs/provenance/CONTRACT.md#references-and-retained-files)
to distinguish citations from scientific inputs. Record cited values and their
meaning in the body README; keep preparation data in the existing source records.
Do not commit downloaded webpages as evidence.

Follow [Sources authoring](../../../docs/sources-catalogue.md#add-or-update-a-source)
when adding or changing inputs: reuse the published identity, preserve each local
file and bind its actual role. Refreshing sources must preserve existing bindings.
Run `node tools/prepare/prepare-provenance.mts` when source records, bindings or generated attribution
change. A README-only spelling correction does not trigger source preparation.
For factsheets, put citations on the individual facts using the existing
[factsheet fields](../../../docs/factsheets.md#editing-and-reproduction).
Preserve each fact's evidence when editing content. A general page credit does
not supply a citation for every number on that page.
Write the card line, introduction and dataset text in the body's `text.json`,
cite the source records a reviewer checks them against, and run
`node tools/prepare/prepare-text.mts`; see [reader text](../../../docs/reader-text.md).

Record the following for selected inputs in the existing source record and
manifest:

- Provider product identifier and version, authoritative URLs, credits and reuse
  terms; required inputs must be checked in or restorable by their acquisition
  recipe. Record their paths and source bindings, not new manifest digests. Keep
  the source’s native labels and stated processing level. Read metadata from the
  selected product, not a neighboring input; resolve contradictory fields before
  relying on them. File hashes, source versions and our code revision are distinct.
- Dimensions, coordinate/longitude conventions, pole, spin, epoch and relevant
  observation geometry. Use the body's own evidence, not another body's values.
- What each proposed view actually conveys: observation, corrected reflectance,
  elevation/scientific visualization, or model/illustration; identify resolution,
  missing coverage, baked illumination and material interpretation limits.

Trace the proposed claims through the actual preparation code. A reputable input
does not establish that the displayed quantity, coverage or date is faithful.
For scientific datasets, positions/orientation, factsheets, or a faithfulness
review, use the relevant checks in [scientific faithfulness](references/scientific-faithfulness.md).

Choose useful, conceptually distinct views. No resolved imagery can mean a
source-informed model with an honest label; it does not justify invented terrain
or fake observation lenses. A source problem blocks that view, not other work.
For shape, prefer measured geometry, then published shape models, then an
observation-constrained approximation with explicit assumptions. A missing exact
mesh alone justifies neither a default sphere nor removing the body. Follow the
[shape selection guidance](references/surface-preparation.md#shape-and-optional-layers).

## 2. Choose the existing preparation recipe

Read the [implementation map](references/implementation-map.md) to locate the
current descriptor, preparation and integration owners, and the
[image and surface guide](../../../docs/surface-preparation.md) for decoding,
UV mapping and atlas generation. Existing packages are
examples of capabilities, not templates for a new controller or a whole planet.

- Use the open-ended `OBJECTS` registry, generic adapter, shared shell and camera.
  Body selection navigates one active scene; standalone moons have their own
  routes, not embedded moon scenes in the parent's package.
- Register additions in the body's descriptor and individual astronomy record,
  following the [contributor guide](../../../src/objects/README.md#register-a-body-without-editing-shared-lists).
  Keep combined catalogues and navigation outputs generated. Do not edit shared
  body lists or force-add ignored build files to register a destination.
- Put source interpretation, geometry, materials, scientific content and
  supported controls in authored package data and shared preparation recipes.
  Keep input, lifecycle, typography and navigation behavior shared.
- Preparation owns reprojection, atlases, lighting banks, charts and static scene
  work. Runtime consumes prepared data through retained DOM. Follow the current
  canonical dataset/residency policy independently of DPR and the rendering
  constraints in the selected checkout's `AGENTS.md`.
- Honor the requested geometry and payload budgets. Extend a shared recipe only
  for a demonstrated missing capability; adding a body is not a platform rewrite.

## 3. Prepare the selected presentation

Resolve source interpretation before committing to an expensive HD bake. For a
new projection, correction or encoding choice, inspect a small map or relevant
native-resolution crop first. Reuse existing preparers for these trials.

Read the applicable preparation guidance **before** processing those assets:

| Source or issue | Preparation decision |
| --- | --- |
| Surface color, calibrated filters or RGB imagery | [Source-backed surface color](../../../docs/color-preparation.md): identify the input quantity and published color meaning; keep measured bands floating until one final display encoding. Registration and calibration do not qualify natural color. Never guess missing visible bands, white balance or an instrument color transform. |
| Photographed shading or mosaic seams | [Photographic observations](references/surface-preparation.md#photographic-observations): corrected source or justified per-observation normalization, then bounded level matching where useful. Preserve shared lighting controls. |
| Soft photographic textures | [Photographic observations](references/surface-preparation.md#photographic-observations): trace intermediate resizes, sample registered originals at the delivered footprint, and separate sampling gains from encoding quality. |
| Published photographic map or mapped paper figure | [Photographic investigation](references/photographic-investigation.md): verify the map frame, surface reference, usable pixels and inherited uncertainty; qualify any digitization before sampling. |
| Unmapped photographs or images with archived surface geometry | [Registered photographic mosaics](references/registered-photographic-mosaics.md): camera holdouts where applicable, quality and visibility checks, deterministic selection, overlap levels, provenance and area coverage. |
| Ground-based frames of a SPHERE survey asteroid | [SPHERE survey photographs](references/sphere-survey-photographs.md): frames, spin record and Horizons tables, then the survey's comparison figure measured through our cameras. |
| Elevation or another measured scalar | [Scientific maps](references/surface-preparation.md#scientific-maps): datum, palette, readable relief and a truthful legend. |
| Incomplete coverage | [Coverage](references/surface-preparation.md#coverage): source validity before interpolation; mark real gaps without erasing observed dark terrain. |
| Irregular terrain or a triangle-mesh budget | [Irregular meshes](references/irregular-meshes.md): choose a representable source shape, simplify before baking, and use PolyCSS native raster triangles. |
| Unresolved appearance, rings or atmosphere | [Shape and optional layers](references/surface-preparation.md#shape-and-optional-layers): evidence determines the presentation and supported capabilities. |
| UV banding, edge artifacts or detached lighting | [Registration](references/surface-preparation.md#registration): distinguish source projection, geometry and overlay fit. |

For a photographic resolution refresh on the existing raster lane, use the
[partial photographic preparer](../../../docs/surface-preparation.md#refresh-photographs-without-rebuilding-geometry).
Keep geometry and lighting fixed, prepare one body at a time, and compare actual
close-ups and image delivery size before accepting the larger texture.

For authored objects, `node tools/prepare/prepare-object.mts <id>...` runs the whole preparation chain in order for those objects only and
names the step that failed; resume with `--from <step>`, stop early with `--to <step>`. With several ids each tool runs once (the authored
preparation three objects at a time), which is minutes for a batch where one call per object and tool was an hour. When a change touches only how a body is
drawn from its images (its scene, presentation or content), add `--reuse-images`: it keeps the published images and rebuilds
the rest from the tracked recipes in seconds, with no raw downloads. It works for the paged-ellipsoid lane (Earth) and the
raster lane (the Moon, Mercury, stars…), and refuses when the published image set would change. A placed star, with its planets and
companion stars, starts with `node tools/objects/star-candidates.mts "<SIMBAD identifier>"` and then `pnpm telescope new-object
<spec.json>` (the spec format is in `tools/objects/new-object/spec.mts`): it writes the whole system from the archives and leaves
only the prose marked `TODO(new-object)`; `--check` runs the chain through the page data on what it wrote, `--bake` the whole chain,
and `telescope new-object --bake <id>...` bakes objects already in the tree. `--from-archive` also quotes each body's English
Wikipedia lead, verbatim and cited at its revision under CC BY-SA 4.0 (`tools/objects/new-object/prose.mts`): the sentence naming the body for
the card and the next for the introduction, looked up by the name Wikipedia titles it with (55 Cancri e for the archive's 55 Cnc e, Kepler-62f); a body with no article gets no quote and a note. A planet whose archive mass is only an upper limit keeps GM 0, the records' unpublished value, and shows the limit ("Under 0.11 Jupiter masses"). One whose archive adopts no mass at all keeps GM 0 too and shows "Not measured". The generator never writes a sentence of its own. Planets for a star that already exists take a `{ "host": "<id>", "planets": [...] }` entry. In a multiple system, `--from-archive` adds each bound wide companion
(El-Badry et al. 2021, chance alignment below 0.1; TIC v8.2 temperature, radius and mass) as a placed star of the host's system at its own Gaia
position, as Alpha Centauri B is; companions too close for Gaia to separate are named in a note, and circumbinary hosts are refused (build them
by hand, as Kepler-16 is: the pair's orbit comes from a paper). `--from-archive` reads eight hosts at once (the 835 transiting hosts within 200 pc draft in about ten minutes) and asks again after a server error or rate limit. A planet's a/R* comes from its chosen paper's row before any other paper's; its inclination, when no row states one, from the impact parameter, else the transit duration and depth. A planet found without a transit is added only when one paper's row measures its whole orbit, inclination included with an error bar (218 such planets outside the universe on 2026-09-24): the orbit is that paper's, timed at periastron, its size the archive's model radius, and a model value says "(model)" on its fact. A confirmed planet the archive lists by a catalogue number (TOI-406.01, letter b) is named by its host and letter. A stated a/R* that disagrees with Kepler's third law by more than a factor of 2 is refused with both values; a star Gaia DR3 gives no radial velocity takes SIMBAD's, cited to the paper it names, else zero with a note, as pi1-gruis records it. A host with no transiting planet to add is left out with the
reasons, and a star's component letter is hyphenated in its id (K2-32B is `k2-32-b`; `k2-32b` is the planet). A planet's colour comes from what is measured
(`tools/objects/new-object/planet-lenses.mts`): a dayside brightness temperature in the archive's emission table gives the "Thermal glow" lens,
otherwise the neutral gray is lit by the host's measured colour; `telescope new-object --thermal <id>...` and `--host-light <id>...` do the
same for planets already in the tree, then `prepare-object.mts` bakes them. Before imagery work on
a moon or small body, `node tools/objects/imagery-candidates.mts [<id> ...]` says whether OPUS holds finer frames than the body ships, and
`--archives <id> ...` searches ALMA, ESO, MAST and DataCite deposits for bodies seen from the ground or Earth orbit; see the
[implementation map](references/implementation-map.md) for these commands and the checks that keep copied facts out.

Generate the assets actually consumed by each selected view—surface and pole
atlases, thumbnails, minimaps, markers and legends where applicable—from the
same prepared interpretation. A minimap needs its own small image, not an HD
texture download. Preserve source detail while comparing encoding quality and
size; WebP q90 is a candidate, not a universal optimum.

Use the shared lens vocabulary by scientific meaning. Include descriptions,
credits and limitations with the data. Complete the selected presentation; do
not add unsupported layers or instruments to make the package look complete.
Keep the essential interpretation visible beside the active view: measured or
modeled, false color, datum and meaningful coverage/date limits. A source note,
tooltip or image alt text alone does not disclose these to a sighted user.

For slit spectroscopy, a detector column may be wavelength rather than a surface
coordinate. Preserve the wavelength/quality planes and construct spatial sampling
from the observation times and slit pointing. Keep an independent numerical fit
reference, validate the image-to-shape placement separately, and preserve missing
spectra. A small reprojection residual is relative to the selected reference frame;
it does not remove inherited absolute shape or pointing uncertainty. The
[HRI-IR preparer](../../../tools/objects/terrestrial-layers/hrii-facets.mts) is one
example using native spectra and a dataset-owned source mesh.

## 4. Inspect the mounted body

Mount the first usable presentation early, before expanding views or polishing.
For a new triangle-mesh presentation, include an early matched headless drag
check using [mesh cost measurements](references/qualification.md#measure-mesh-changes).
Compare it with the body's source at useful framing and close zoom. Inspect
applicable seams, poles/shape extremities, coverage boundaries and the limb.
Include low-detail areas: face-aligned discontinuities can be easier to see
there than in detailed terrain. Compare them with the source before treating
them as limitations of the observations.
Check a few independent numerical anchors for changed scientific quantities or
positions. Source closure and self-consistent prepared files cannot detect a
shared wrong interpretation; attractive screenshots cannot validate it either.
Choose a meaningful reference before using Pixelmatch; it is not a mandatory
check for every new view. Different datasets and A/A repeats cannot qualify a
new surface. Follow the [comparison decision rule](../../../docs/provenance/CONTRACT.md#say-what-the-checks-prove).
For a reported defect, start with the user's actual camera, lens and settings;
an ambient tab URL alone may not identify the body shown in a screenshot.

Inspect each selected view with its supported lighting states. Flood lighting
and directional Shadows are distinct; disabling Shadows to hide baked shading
is not a correction. Check scientific-map shading on its own terms. Fix source
or registration errors in preparation and regenerate affected companion assets.
Show useful visual results while continuing the authorized work; a preview is
not an automatic stop for approval.

## 4a. Catalog faithfulness reviews and repairs

For a requested catalog-wide review, establish coverage from registered
`object.json` files, source manifests and README-only stubs. Reuse existing audit
and ledger classifications, verifying their versions and updating changed or
unreviewed packages. Classify controlled maps/cameras, pending model transfers,
scientific/model fields, insufficiently registered photographs and shape-only
scenes. Keep counts and IDs with the maintained review; file counts or texture
existence alone do not establish source qualification. A repair of known findings
does not require repeating the whole catalog review or creating another report.

Accept a producer map only when its body-fixed coordinate frame, shape/map
reference surface and missing-data convention are documented. Accept a source
camera when the release supplies the shape/body frame and either distributed
surface correspondences with disjoint holdouts or an equivalent measured
camera record. A limb/terminator-only fit, generic sphere, approximate orbit or
attitude, visual similarity, or same-renderer screenshot does not establish
image-to-shape registration. Keep an honest model or coarse pointing view, mark
the photographic lens deferred, and preserve the source gaps.

For image-transfer diagnostics, distinguish detector alignment from surface
control. A nearly repeated view can correlate closely without constraining the
mesh frame or depth. Inspect distributed interior detail and a meaningfully
different viewing direction; retain contradictory results, including reverse
transfer when it exposes a concrete ambiguity. Keep fitting pixels separate
from holdouts. Report native pixel scales, search boundaries and broad or weak
correlation peaks. A correlation score or an arbitrary residual cutoff is not a
publication gate. Removing a brightness plane for a diagnostic must not change
the delivered photograph or be described as a photometric calibration.

Treat model transfer as its own gate: a map registered to one shape cannot be
draped onto another shape until their frame and surface correspondence are
shown. Do not delete a candidate before checking the source release or paper;
document the unresolved transfer and retain useful non-photographic products.
Scientific maps, thermal/radar/albedo fields and geology must be labeled by
quantity and must never be presented as direct photographs merely because they
are raster data.

A requested faithfulness repair fixes the cause in source interpretation,
registration, preparation or affected package data, then regenerates and checks
the dependent outputs. Correcting labels is sufficient only when the defect is
the label itself. Investigate a supported repair before withholding a surface;
if it remains unqualified, preserve useful source/model data and state the
unresolved result. Keep renderer and geometry changes within the user's scope.

## 5. Finish delivery

Choose local checks from the [qualification change table](references/qualification.md#check-what-changed)
and the contract's
[PR check rules](../../../docs/provenance/CONTRACT.md#pull-requests). Do not launch
all-body preparation or test suites by default for one body. Reuse passing evidence
until relevant changes or unresolved failures invalidate it.
Keep project-required checks; do not add a new dashboard, gate framework,
Burnlist or exhaustive test matrix to implement an ordinary body. Source
restoration, fresh runtime installation and delivery measurements apply when
their triggering acquisition, asset or delivery changes are present.

A body PR is finished when its branch turns the change on end to end. It holds:

- the recipe, source pins, acquisition operations and catalogued bindings;
- the prepared outputs the recipe produces: `object.json`'s pin and the refreshed `inventory.json`
  (written automatically by the preparation tools). Nothing under `prepared/` is committed: publish
  the baked bytes with `node tools/assets/publish-runtime-assets.mts --object=<id>` before opening the PR.
  `prepared/object.json`, `prepared/page.json` and `prepared/provenance.json` are regenerated by
  `predev`/`prebuild` and are not inventoried;
- the body README's account of sources, processing, results and known problems;
- any published photometric model as a cited record, used inside its fitted range.

Do not present unused implementation as a finished body feature. When an archive
product needs a reader, route or kernel bank, first check the shared owners.
If adding that capability is authorized, implement it there with its source
checks and a consuming body recipe; the first consumer may be a single body.
Do not introduce private body executables. If the missing capability is outside
scope, record the concrete gap and use the archive-product issue template for a
requested handoff. An issue or research diagnostic does not finish an authorized
implementation that remains possible within scope.

For changed datasets, update the body README's source choices, processing,
results and known problems. Update affected credits and reports in the same change. Keep common
usage and commands in shared guides. Save cited screenshots in Git or agreed
storage and link them; a local output path cannot be reviewed by someone else.

While drafting and before committing documentation, use the contract's
[plain-language rules](../../../docs/provenance/CONTRACT.md#plain-language).
Check the reader's task: can they find the source, understand the displayed
quantity and its limits, inspect the result, and find the record to change?
Replace vague claims with the source, action and result; preserve scientific
terms and qualifications. Inspect the rendered README with methods collapsed.
Use reader feedback to fix confusing wording or structure; do not treat agent
review or a word count as reader testing.

Report the result appropriate to the request, checked outcomes and remaining
limitations. For implementation, include the working location/URL and supported
views. Finish the selected views; record useful unresolved
candidates in the ledger without making complete dataset coverage a hidden
delivery requirement. A first lens proves only its stated claims.
Complete authorized commit/PR work, respecting the
user's merge instructions. Source fidelity, visual acceptance and runtime
correctness are separate claims; a successful build alone proves none of them.
