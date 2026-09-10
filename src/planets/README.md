# Adding and maintaining a celestial body

Every detailed body is an authored data package under `src/planets/<id>/`.
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
src/planets/<id>/
  README.md                    sources, processing, evidence and known problems
  NOTICE.md, LICENSE*          attribution and applicable terms
  object.json                  authored recipe and prepared transport reference
  source/manifest.json         exact inputs, documents and intermediate pins
  source/preparation/          acquisition and capability configuration
  source/content/              body-owned editorial content and controls
  source/                      original inputs, labels and necessary source notes
  prepared/                    generated content, geometry and lineage records
  prepared/page.json           generated page assets and controls
  runtime-assets.json          generated runtime image inventory

public/scenes/<id>/             installed/generated serving assets
tests/objects/unit/<id>/        body-specific scientific and package checks
tests/objects/browser/<id>/     profiles for the shared browser harness
site/pages/[id].astro           one shared route for all body ids
```

Use the current authored branch of `tools/object-package-contract.mts` for
required files and `tests/objects/source-closure.test.mjs` for source ownership.
The latter requires data-only body packages. Acquisition/preparation code lives
in shared `tools/objects/` families; runtime and presentation behavior live in
the shared renderer and shell. Do not copy private `runtime/`, `site/` or
`tools/` directories from old documentation or historical packages.

Scientific inputs determine geometry, appearance, supported views and physical
facts. Reuse existing preparation code with the new body's own source parameters.
A new recipe operation needs shared code, records of its inputs and outputs,
and tests of its behavior. Keep source interpretation and static processing out of
runtime. Preserve pinned original bytes and reproducible preparation.

## Sources and delivery

The source manifest owns exact input IDs, sizes, hashes, credits and terms.
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
| Run body tests | `node --test tests/objects/unit/<id>/*.test.mjs` |
| Run shared package, renderer, platform and shell tests | `pnpm test` |
| Run relevant preparation tests | `pnpm test:preparation` with the supported selection |
| Production build and assembly | `pnpm build` |
| Shared DOM/browser checks | `pnpm test:browser <served-worktree-url> <id>` |
| Extended behavior conformance | `pnpm test:browser:conformance <served-worktree-url> <id>` |

Build the shared preparation tools before invoking their `dist/` entry points.
`pnpm test:planets` runs the registry; its current runner does not implement an
`--object` filter. Use the direct body test path for focused checks.
`pnpm test` excludes the separate body and preparation runners. Read the browser
harness coverage before reporting results; a focused case is not an aggregate
pass. Tests requiring sources/assets need those dependencies installed.

## Update documentation with the change

Use the [body README examples](../../docs/provenance/CONTRACT.md#examples).
The README explains the body’s sources, processing, evidence and known problems.
Link detailed source notes, exact manifests, credits and original reports from
that explanation. Keep shared commands and usage here instead of repeating them
for each body.
Keep earlier test results and their limits. Do not replace original failure
reports with summaries or claim a visual check without inspecting the images.
The [evidence rules](../../docs/provenance/CONTRACT.md#save-enough-evidence-to-check-the-result)
explain where new reports go and when to update older records.
