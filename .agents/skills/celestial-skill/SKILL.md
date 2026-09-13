---
name: celestial-skill
description: "Create, repair, and qualify source-backed celestial body packages for cssEarth through its generic object contract. Use for planets, moons, dwarf planets, asteroids, stars, and unfinished body packages. Excludes general astronomy questions and unrelated application refactors."
---

# Celestial Skill

Maintain this skill in the repository. Read the selected checkout's
[provenance and documentation contract](../../../docs/provenance/CONTRACT.md)
and the target body's `README.md`, `NOTICE.md` and manifests.
The contract combines PDS4 1.26.0 provenance guidance with ISO 24495-1:2023
plain-language principles for our docs and evidence.
Use its pinned references; add body-specific facts without another report format.
This skill explains how to prepare and check a body. Update it in the same PR when shared
preparation changes. Installed copies should follow this version.

Build a body whose appearance is supported by its sources and whose behavior
comes from cssEarth's shared application. Follow this workflow for a new body;
for a repair, enter at the affected stage and reuse valid work already done.
Research and review requests do not imply implementation or publication.

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
respect any explicit geometry or topology restriction in the task's scope.
Explain meaningful model differences beside the dataset and qualify registration,
coverage and picking against the selected mesh. The [implementation map](references/implementation-map.md)
locates the existing support for alternative models.

For shape-only alternatives, bind each `shapeViews` entry to its selected
`radialTerrain` source as well. Verify that generated surface provenance names
that mesh, rather than reusing the default mesh's source for every dataset.

Surface places also belong to a source frame. Use `source/preparation/features.json`
and its pinned `landmarks` document for mission-defined regions, paper coordinates,
or explicitly inferred model anatomy. Keep mission names distinct from IAU names.
Derive region anchors from the released map and check them against the unchanged
display mesh; a label point does not establish a region centre, size or boundary.
For alternative meshes, select the matching prepared `surfaceHit.lensRanges`
entry and expose those places only on that dataset. A shared body name does not
make coordinates transferable between models. Keep approximate placement visible
in the caption. Unresolved photograph-to-shape registration cannot establish a
terrain landmark; neither can a camera direction alone.

For a body explicitly prepared as a reference sphere, published geographic
landmarks can use that sphere without a triangle hit mesh. This exception does
not apply to missing irregular-body meshes or Cartesian model coordinates.

Check label discovery with no place selected: selection bypasses the zoom gate.
Inspect whole-body framing, a closer view and rotation on a sparse asteroid,
comet and small moon. Physical size alone does not require a separate label
rule: the shared camera expresses zoom relative to the body. The shared feature
preparer gives sparse catalogues a count floor of 200 when assigning discovery
tiers, so two names are not stretched from minimum to maximum zoom. Explicit
mission-landmark tiers remain authored choices; broad regions should appear
while the whole body is still visible. Keep the existing screen-size, limb,
overlap and label-cap checks, and verify the smallest named features still need
enough screen space. Do not use a successful search-and-fly-to as proof that
places can be discovered by looking at the body.

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

Inspect available pinned inputs before downloading alternatives. Before
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

For photograph-to-shape work, inspect the selected shape release as a bundle
before deriving a camera or looking for a replacement model. Read its labels,
file inventory and linked methods for companion image-geometry tables,
reconstructed pointing, control points, backplanes and detector-quality files.
Compare their observation IDs and model frame with the image headers; headers
may retain preliminary geometry superseded by the shape reconstruction.
Read kernel comments before accepting a body frame: a mission-hosted file can
retain placeholder pole coordinates or a pre-encounter rotation period. A
trajectory correction does not also establish the shape's prime meridian or
rotational phase. Keep these questions separate in the qualification evidence.
Establish sample/line order, pixel origin, aspect ratio, flips and units, then
inspect one native-pixel projection before fitting or baking. Follow the
[source investigation sequence](references/registered-photographic-mosaics.md#inspect-the-release-before-reconstructing-geometry)
for conflicting or undocumented conventions. Record the selected companion and
any remaining inference in the existing recipe and body README.

Search the relevant papers explicitly as well as the data archives. Inspect
full text, tables, appendices and supplementary files: a usable radius table,
mesh, camera solution or registration controls may be published there without
a separate dataset download. Follow authoritative open-access or author-repository
copies when available. Match the paper's model version, coordinates, units and
observation identifiers to the selected inputs before using its numbers.
Record any transcription or digitization and check it against the published
table or figure. A paper's availability does not establish image or data reuse
rights; unresolved access remains unresolved evidence, not proof of absence.

Explain the selected sources and useful alternatives once in the body's README
or a linked detailed method: source link,
what it adds, and whether it is included, excluded or unresolved, with a reason.
Compare detail, registration, coverage and reuse terms before choosing. A better
mosaic can replace a weaker one without becoming a duplicate lens. Missing
metadata or a failed download leaves a candidate unresolved; it is not evidence
that the dataset does not exist. Respect explicit user exclusions and scope.
Stop once the promising candidates have a disposition; do not build an exhaustive
catalog or repeat this survey for an unrelated repair.

Use the contract's [reference retention rules](../../../docs/provenance/CONTRACT.md#references-and-retained-files)
to distinguish citations from scientific inputs. Record cited values and their
meaning in the body README; keep preparation data in the existing source records.
Do not commit downloaded webpages as evidence.

Follow [Sources authoring](../../../docs/sources-catalogue.md#add-or-update-a-source)
when adding or changing inputs: reuse the published identity, preserve each local
file and bind its actual role. Refreshing sources must preserve existing bindings.
Run `pnpm prepare:sources` after source or attribution changes.
For factsheets, put citations on the individual facts using the existing
[factsheet fields](../../../docs/factsheets.md#editing-and-reproduction).
Preserve each fact's evidence when editing content. A general page credit does
not supply a citation for every number on that page.

Record the following for selected inputs in the existing source record and
manifest:

- Provider product identifier and version, authoritative URLs, credits and reuse
  terms; required inputs must be checked in or restorable from their pins. Keep
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
  following the [contributor guide](../../../src/planets/README.md#register-a-body-without-editing-shared-lists).
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
| Multiple photographs registered to a surface | [Registered photographic mosaics](references/registered-photographic-mosaics.md): camera holdouts, quality and visibility checks, deterministic selection, overlap levels, provenance and area coverage. |
| Elevation or another measured scalar | [Scientific maps](references/surface-preparation.md#scientific-maps): datum, palette, readable relief and a truthful legend. |
| Incomplete coverage | [Coverage](references/surface-preparation.md#coverage): source validity before interpolation; mark real gaps without erasing observed dark terrain. |
| Irregular terrain or a triangle-mesh budget | [Irregular meshes](references/irregular-meshes.md): choose a representable source shape, simplify before baking, and use PolyCSS native raster triangles. |
| Unresolved appearance, rings or atmosphere | [Shape and optional layers](references/surface-preparation.md#shape-and-optional-layers): evidence determines the presentation and supported capabilities. |
| UV banding, edge artifacts or detached lighting | [Registration](references/surface-preparation.md#registration): distinguish source projection, geometry and overlay fit. |

For a photographic resolution refresh on the existing raster lane, use the
[partial photographic preparer](../../../docs/surface-preparation.md#refresh-photographs-without-rebuilding-geometry).
Keep geometry and lighting fixed, prepare one body at a time, and compare actual
close-ups and image delivery size before accepting the larger texture.

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

## 4a. Review every object before a faithfulness PR

When a faithfulness change spans the catalog, inventory every registered
`object.json` and `source/manifest.json` first, plus README-only stubs. Classify
each package as a controlled source map/camera, a source product with a pending
shape transfer, a scientific or model-derived field, an insufficiently
registered photographic lens, or a shape/elevation-only scene. Record the
counts and complete IDs in a maintained shared review document; do not infer
coverage from the number of files or from the existence of a texture.

Accept a producer map only when its body-fixed coordinate frame, shape/map
reference surface and missing-data convention are documented. Accept a source
camera when the release supplies the shape/body frame and either distributed
surface correspondences with disjoint holdouts or an equivalent measured
camera record. A limb/terminator-only fit, generic sphere, approximate orbit or
attitude, visual similarity, or same-renderer screenshot does not establish
image-to-shape registration. Keep an honest model or coarse pointing view, mark
the photographic lens deferred, and preserve the source gaps.

Treat model transfer as its own gate: a map registered to one shape cannot be
draped onto another shape until their frame and surface correspondence are
shown. Do not delete a candidate before checking the source release or paper;
document the unresolved transfer and retain useful non-photographic products.
Scientific maps, thermal/radar/albedo fields and geology must be labeled by
quantity and must never be presented as direct photographs merely because they
are raster data. A catalog faithfulness PR changes package evidence and
metadata only; it does not change the shared renderer or geometry architecture.

## 5. Finish delivery

Use [qualification](references/qualification.md) for the relevant checks,
source restoration, fresh runtime installation and measured delivery size.
Choose local checks from its change table and the contract's
[PR check rules](../../../docs/provenance/CONTRACT.md#pull-requests). Do not launch
all-body preparation or test suites by default for one body. Reuse passing evidence
until relevant changes or unresolved failures invalidate it.
Keep project-required checks; do not add a new dashboard, gate framework,
Burnlist or exhaustive test matrix to implement an ordinary body.

A body PR is finished when its branch turns the change on end to end. It holds:

- the recipe, source pins, acquisition operations and catalogued bindings;
- the prepared outputs the recipe produces;
- the body README's account of sources, processing, results and known problems;
- any published photometric model as a cited record, used inside its fitted range.

Do not open a mergeable PR with code that nothing uses yet. When an archive
product needs a reader, route or kernel bank that does not exist, open the
archive-product issue template instead of writing one for a single body.

Update the body README with source choices, processing, results and known
problems. Update affected credits and reports in the same change. Keep common
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

Finish with the working location/URL, supported views, checked outcomes and
remaining limitations, including useful unresolved dataset candidates. A working
first lens does not establish that the body's useful datasets have been covered.
Complete authorized commit/PR work, respecting the
user's merge instructions. Source fidelity, visual acceptance and runtime
correctness are separate claims; a successful build alone proves none of them.
