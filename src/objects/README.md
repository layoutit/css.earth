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
UV mapping and texture atlases. The contract explains source notes, credits,
test reports and where to save them. For a telescope-derived view, start with the [telescope command guide](../../packages/telescope-cli/README.md#using-a-result-in-a-body-scene). Its qualified delivery and standalone sphere export do not automatically create a normal scene dataset.

## Package layout

```text
src/objects/<id>/
  README.md                    sources, processing, evidence and known problems
  investigations.json          every examined source, route, dataset and frame, with its decision
  NOTICE.md, LICENSE*          attribution and applicable terms
  object.json                  catalogue entry, recipe and prepared transport reference
  text.json                    card line, introduction and dataset text, with their sources
  source/manifest.json         input paths, documents, acquisition and source bindings
  source/preparation/          acquisition and capability configuration
  source/content/              body-owned facts, dataset recipes and controls
  source/                      original inputs, labels and necessary source notes
  prepared/                    generated content, geometry and lineage records
  inventory.json               generated inventory of the baked files (public textures and prepared/*)

public/scenes/<id>/             installed/generated serving assets
public/navigation/body-<id>*.webp   prepared navigation images
public/navigation/<id>-context.webp  optional resolved context image
packages/astronomy/data/bodies/<id>.json  physical data and orbit records
src/objects/<id>/*.test.mts      object-specific application checks
site/test/                     shared runtime/package, shell, route and rendered-page checks
site/pages/[id].astro           one shared route for all body ids
```

`site/build/object-package-contract.mts` defines the required files; the source
manifest's coverage check owns source ownership. Body packages are data-only.
Acquisition and preparation code lives in shared `packages/bake/src/objects/`
topics and per-body `packages/bake/authoring/<body>/` (or
`packages/telescope-cli/authoring/<body>/`) scripts; runtime and presentation
behavior live in the shared renderer and shell. Do not copy private `runtime/`,
`site/` or `tools/` directories from old documentation or historical packages.

Scientific inputs determine geometry, appearance, supported views and physical
facts. Reuse existing preparation code with the new body's own source parameters.
A new recipe operation needs shared code, records of its inputs and outputs,
and tests of its behavior. Keep source interpretation and static processing out
of runtime.

## Register a body without editing shared lists

Put the search name, classification, color, distance in AU, description and
system name in `object.json` under `properties.catalog`. A folder without this
entry stays unpublished. Add `context: {}` there to include a Solar System body
in the shared Sun view. New entries can omit `order`; equal priorities sort by
ID. Do not renumber other bodies.

The astronomy package keeps each body's physical values, orbit records,
independent vector samples and acquisition choices in `data/bodies/<id>.json`.
Keep provider URLs, epochs, units and limitations with the values. Acquisition
tools accept `--object=<id>` for asteroid, comet and moon updates.

After authoring the sources and records, run `pnpm prepare:catalog` and
`pnpm build:astronomy`, then `node packages/bake/cli/prepare-navigation.mts <id>` and the selected-body
preparation command below. If this is a parent's first moon, also prepare the
parent's navigation image. Commit the new body's files and navigation images.

Builds assemble `OBJECTS`, astronomy exports, solar geometry, Sun context,
navigation metadata and the minimap. These combined outputs are ignored. Do not
edit or force-add them, or append entries to shared TypeScript tables or the
Sun's source list. The runtime reads markers from packed pages
(`public/navigation/body-markers-NN@2x.webp`, in catalogue order). Adding a body
redraws its page and moves the tiles after it, so commit the redrawn pages.
After merging main into a branch that adds bodies, run
`node packages/bake/cli/prepare-navigation.mts <id>...` and
`prepare-object.mts <id>... --from world` before `pnpm install` or
`build:preparation`, which refuse a page whose width does not match its members.

## Sources and delivery

The source manifest owns input IDs, paths, acquisition, credits and terms.
Tracked source files are identified by Git, not manifest hash fields. Downloads
are restored by path from their origin or source cache; runtime inventories
separately verify the published outputs by byte count and SHA-256.
Follow [Sources authoring](../../docs/sources-catalogue.md#add-or-update-a-source)
for canonical identities and `sourceBinding` on each input. Reuse an existing
published source across bodies. Every new source note inside `source/` needs
its own manifest entry.

The catalogues read which sources each dataset uses from these records; see
[object provenance](../../docs/object-provenance.md). No provenance file is generated.

A new star, planet or companion starts from `pnpm telescope new-object SPEC.json`
(`packages/telescope-cli/src/new-object/spec.mts` documents the spec): it writes the whole package
from Gaia DR3, SIMBAD, the spectrophotometric archives and the NASA Exoplanet Archive,
leaves only prose marked `TODO(new-object)`, and `--bake` runs the preparation chain.
`--from-archive HOST...` drafts the spec for transiting systems.

Installation and common controls belong in the [root README](../../README.md).
Read the current `package.json` and runner arguments before using commands:

| Purpose | Entry point |
| --- | --- |
| Install published prepared assets for one body | `pnpm setup:assets --object=<id>` |
| Start the shared development site | `pnpm dev` |
| Restore missing source inputs | `node packages/bake/cli/restore-source-inputs.mts --object=<id>`; the source manifest reader checks declared-file coverage, not stored digests |
| Prepare one authored package | `pnpm prepare:objects -- --object=<id>` |
| Update the source/mission catalogues | `node site/build/prepare/prepare-facilities.mts --catalog-only` |
| Bind new inputs to catalogue records | `node site/build/prepare/author-source-records.mts <id>` |
| Check shared body runtime behavior | `node --test site/world/runtime-package.test.mts`; run affected scientific tests beside their owning modules too |
| Run the full package, renderer, native, preparation and lab sequence | `pnpm test`; choose its individual suites for focused work |
| Check source identities and bindings | `node --test "src/sources/*.test.mts" "packages/bake/src/objects/sources/*.test.mts"`, or select the affected files |
| Create the oracle environment and regenerate oracle fixtures | `node packages/core/src/node/oracle/setup.mts`, `node packages/core/src/node/oracle/run.mts`; see `packages/core/src/node/oracle/README.md` |
| Run a preparation test | `node --test packages/bake/authoring/<body>/<name>.test.mts` when the selected test uses Node |
| Production build and assembly | `pnpm build` |
| Rendered-page assertions over the built HTML | `node --test site/journeys/rendered-page.test.mts` |

Run a `packages/*/cli/` command by its entry in `packages/<pkg>/cli/`; the library of the same name under
`packages/<pkg>/src/` is what other code imports. A site-owned preparer (one that
reads a site module) runs directly from `site/build/prepare/`.
Select checks using the [PR rules](../../docs/provenance/CONTRACT.md#pull-requests);
this table lists available commands, not a checklist for every body addition.
Shared tests discover body packages; add a scientific regression where its
calculation or preparation behavior is owned. Input-dependent tests may skip on
a bare checkout. Record those skips, install the needed inputs for a
qualification claim, and inspect real browser output for changed visuals or
interactions. Built-HTML assertions alone do not establish browser behavior.

## Update documentation with the change

Use the [body README examples](../../docs/provenance/CONTRACT.md#examples).
The README explains the body's sources, processing, evidence and known problems.
Link detailed source notes, exact manifests, credits and original reports from
that explanation. Record what you examined in the object's investigation ledger,
including failed trials, and link the ledger from the README. Keep shared
commands and usage here instead of repeating them for each body. Do not claim a
visual check without inspecting the images. The
[evidence rules](../../docs/provenance/CONTRACT.md#save-enough-evidence-to-check-the-result)
explain where new reports go and when to update older records.
