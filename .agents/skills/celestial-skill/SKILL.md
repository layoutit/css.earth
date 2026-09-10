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
A restriction on renderer changes does not by itself freeze prepared geometry;
respect any explicit geometry or topology restriction in the task's scope.
Explain meaningful model differences beside the dataset and qualify registration,
coverage and picking against the selected mesh. The [implementation map](references/implementation-map.md)
locates the existing support for alternative models.

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
survey beyond the first usable texture. Search the relevant mission archives,
mapping repositories (such as PDS, USGS and LPI/USRA), and papers' linked data
releases for better-resolution, registered or photometrically corrected imagery
and useful complementary products, such as elevation, geology or composition.
Follow promising citations to the actual release; a display-texture catalog or
press-image search alone does not establish what datasets exist.

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
to distinguish citations, executable inputs and necessary snapshots. A research
download does not automatically belong in the body package.

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
| Photographed shading or mosaic seams | [Photographic observations](references/surface-preparation.md#photographic-observations): corrected source or justified per-observation normalization, then bounded level matching where useful. Preserve shared lighting controls. |
| Multiple photographs registered to a surface | [Registered photographic mosaics](references/registered-photographic-mosaics.md): camera holdouts, quality and visibility checks, deterministic selection, overlap levels, provenance and area coverage. |
| Elevation or another measured scalar | [Scientific maps](references/surface-preparation.md#scientific-maps): datum, palette, readable relief and a truthful legend. |
| Incomplete coverage | [Coverage](references/surface-preparation.md#coverage): source validity before interpolation; mark real gaps without erasing observed dark terrain. |
| Irregular terrain or a triangle-mesh budget | [Irregular meshes](references/irregular-meshes.md): choose a representable source shape, simplify before baking, and use PolyCSS native raster triangles. |
| Unresolved appearance, rings or atmosphere | [Shape and optional layers](references/surface-preparation.md#shape-and-optional-layers): evidence determines the presentation and supported capabilities. |
| UV banding, edge artifacts or detached lighting | [Registration](references/surface-preparation.md#registration): distinguish source projection, geometry and overlay fit. |

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
For a reported defect, start with the user's actual camera, lens and settings;
an ambient tab URL alone may not identify the body shown in a screenshot.

Inspect each selected view with its supported lighting states. Flood lighting
and directional Shadows are distinct; disabling Shadows to hide baked shading
is not a correction. Check scientific-map shading on its own terms. Fix source
or registration errors in preparation and regenerate affected companion assets.
Show useful visual results while continuing the authorized work; a preview is
not an automatic stop for approval.

## 5. Finish delivery

Use [qualification](references/qualification.md) for the relevant checks,
source restoration, fresh runtime installation and measured delivery size.
Reuse passing evidence until changes or unresolved failures invalidate it.
Keep project-required checks; do not add a new dashboard, gate framework,
Burnlist or exhaustive test matrix to implement an ordinary body.

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
