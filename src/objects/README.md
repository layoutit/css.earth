# Adding and maintaining a celestial body

Every detailed body is an authored data package under `src/objects/<id>/`.
The directory name also covers the Sun, moons, dwarf planets, asteroids and
comets. `OBJECTS` in `site/objects.mts` remains the only rendered-body registry.
Navigation selects one active scene; it does not embed child scenes.

Read [AGENTS.md](../../AGENTS.md), the
[provenance and documentation contract](../../docs/provenance/CONTRACT.md) and
[celestial skill](../../.agents/skills/celestial-skill/SKILL.md) before body work.
The skill explains source selection and preparation. The shared
[image and surface guide](../../docs/surface-preparation.md) explains the tools,
UV mapping and texture atlases. The contract explains
source notes, credits, test reports and where to save them. Its
[standards mapping](../../docs/provenance/CONTRACT.md#standards-basis) combines
PDS4 1.26.0 provenance guidance with ISO 24495-1:2023 plain-language principles,
using the existing files.

## Package layout

```text
src/objects/<id>/
  README.md                    sources, processing, evidence and known problems
  investigations.json          every examined source, route, lens and frame, with its decision
  NOTICE.md, LICENSE*          attribution and applicable terms
  object.json                  catalogue entry, recipe and prepared transport reference
  text.json                    card line, introduction and dataset text, with their sources
  source/manifest.json         exact inputs, documents and intermediate pins
  source/preparation/          acquisition and capability configuration
  source/content/              body-owned facts, dataset recipes and controls
  source/                      original inputs, labels and necessary source notes
  prepared/                    generated content, geometry and lineage records
  prepared/page.json           generated page assets and controls
  runtime-assets.json          generated runtime image inventory

public/scenes/<id>/             installed/generated serving assets
public/navigation/body-<id>*.webp   prepared navigation images
public/navigation/<id>-context.webp  optional resolved context image
packages/astronomy/data/bodies/<id>.json  physical data and orbit records
tests/objects/unit/<id>/        hand-written body checks; template bodies live in the shared anchor tables instead
tests/objects/browser/<id>/     profiles for the shared browser harness
site/pages/[id].astro           one shared route for all body ids
```

Use the current authored branch of `tools/contract/object-package-contract.mts` for
required files and `tests/objects/source-closure.test.mts` for source ownership.
The latter requires data-only body packages. Acquisition/preparation code lives
in shared `tools/objects/` families; runtime and presentation behavior live in
the shared renderer and shell. Do not copy private `runtime/`, `site/` or
`tools/` directories from old documentation or historical packages.

Scientific inputs determine geometry, appearance, supported views and physical
facts. Reuse existing preparation code with the new body's own source parameters.
A new recipe operation needs shared code, records of its inputs and outputs,
and tests of its behavior. Keep source interpretation and static processing out of
runtime. Preserve pinned original bytes and reproducible preparation.

## Register a body without editing shared lists

Put the search name, classification, color, distance in AU, description and
system name in `object.json` under `properties.catalog`. A folder without this
entry stays unpublished. Add `context: {}` there to include a Solar System body
in the shared Sun view; an optional context name or color overrides its search
presentation. Existing `order` values preserve earlier catalogue ordering.
New entries can omit them; equal priorities sort by ID. Do not renumber other bodies.

The astronomy package keeps each body's physical values, retained orbit records,
independent vector samples and acquisition choices in `data/bodies/<id>.json`.
Those are scientific library inputs, separate from the application's catalogue
entry. Keep provider URLs, epochs, units and limitations with the values.
Acquisition tools accept `--object=<id>` for asteroid, comet and moon updates.
They update that body's records; building the library needs no downloads.

After authoring the sources and records, run `pnpm prepare:catalog` and
`pnpm build:astronomy`, then `pnpm prepare:navigation <id>` and the selected-body
preparation command below. If this is a parent's first moon, also prepare the
parent's navigation image. Commit the new body's files and navigation images.
Adding a capability or changing a parent's physical data can still require
shared code or related-body changes; explain that dependency in the PR.

Builds assemble `OBJECTS`, astronomy exports, solar geometry, Sun context,
navigation metadata and the minimap. These combined outputs are ignored. Do not
edit or force-add them, or append entries to shared TypeScript tables or the
Sun's source list. Marker images use body URLs with one tile, so adding a marker
cannot shift another body's sprite coordinates.

## Sources and delivery

The source manifest owns exact input IDs, sizes, hashes, credits and terms.
Follow [Sources authoring](../../docs/sources-catalogue.md#add-or-update-a-source)
for canonical identities and `sourceBinding` on each input. Reuse an existing
published source across bodies; local files keep their own identities.
Necessary source files must be checked in or restored by the existing acquisition
recipe. The manifest also lists documents and generated intermediate files.
Every new source note inside `source/` needs its own manifest entry.

`prepared/provenance.json` is generated product lineage; see its
[existing contract](../../docs/object-provenance.md). A recovered record is not
proof of fresh acquisition. Runtime inventories describe prepared delivery;
source restoration and runtime installation are separate checks.

Installation and common controls belong in the [root README](../../README.md).
Read the current `package.json` and runner arguments before using commands:

| Purpose | Entry point |
| --- | --- |
| Install published prepared assets for one body | `pnpm setup:assets --object=<id>` |
| Start the shared development site | `pnpm dev` |
| Acquire missing pins / verify present sources | `node tools/objects/dist/operations.js acquire <id>` / add `--verify-only` |
| Prepare one authored package | `pnpm prepare:planets -- --object=<id>` |
| Update source and mission catalogues | `pnpm prepare:sources` |
| Give a new download its first pin | `node tools/sources/pin-object-documents.mts <id> --adopt-downloads` (`--check` only reports). Files authored here carry no pin; git records them |
| Bind new inputs to catalogue records | `node tools/sources/author-source-records.mts <id>` |
| Run body tests | `CSSEARTH_TEST_OBJECTS=<id> node --test tests/objects/unit/*.test.mts tests/objects/unit/<id>/*.test.mts` (a body covered only by a shared anchor table has no directory of its own); `pnpm test:objects` runs every body file |
| Run shared package, renderer, platform and shell tests | `pnpm test` |
| Check source identities, bindings and catalogue generation | `pnpm test:sources` |
| Create the oracle environment and regenerate oracle fixtures | `node tools/oracles/setup.mts`, `node tools/oracles/run.mts`; see `tools/oracles/README.md` |
| Run a preparation test | `node --test tools/objects/<recipe>/<name>.test.mts` when the selected test uses Node |
| Production build and assembly | `pnpm build` |
| Rendered-page assertions over the built HTML | `node --test site/test/rendered-page.test.mts` |

Build the shared preparation tools before invoking their `dist/` entry points.
Select checks using the [PR rules](../../docs/provenance/CONTRACT.md#pull-requests);
this table lists available commands, not a checklist for every body addition.
`pnpm test:planets` runs the registry; its current runner does not implement an
`--object` filter. Use the direct body test path for focused checks.
`pnpm test` excludes the separate body and preparation runners. Read the browser
harness coverage before reporting results; a focused case is not an aggregate
pass. Tests requiring sources/assets need those dependencies installed.

## Update documentation with the change

Use the [body README examples](../../docs/provenance/CONTRACT.md#examples).
The README explains the body’s sources, processing, evidence and known problems.
Link detailed source notes, exact manifests, credits and original reports from
that explanation. Record what you examined in the object's investigation ledger,
including failed trials, and link the ledger from the README. Keep shared commands and usage here instead of repeating them
for each body.
Keep earlier test results and their limits. Do not replace original failure
reports with summaries or claim a visual check without inspecting the images.
The [evidence rules](../../docs/provenance/CONTRACT.md#save-enough-evidence-to-check-the-result)
explain where new reports go and when to update older records.
