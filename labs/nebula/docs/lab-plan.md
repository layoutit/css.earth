# Nebula Lab plan

The north is in the [lab README](../README.md#purpose-owners-north-2026-10-08). This page covers how the lab gets there: the tabs, the CLI, the audit of today's lab, and the data that has to move.

Audited on 2026-10-08, against the working tree of `feat/lab-published-plates`, including its uncommitted changes.

## 1. Shape

```text
labs/nebula/run.mts <command> <id>        ← agents
        │  writes progress events
        ▼
src/objects/<id>/.local/lab/progress.jsonl ──► lab server ──► UI progress strip
        │
        ▼  same shared code
@cssearth/bake + site preparation commands ──► src/objects/<id>/ (committed + prepared/)
        ▲
UI buttons call the same CLI commands (via the lab server)
```

- A tab never runs code that the CLI can't run.
- The UI starts a job by running a CLI command. It never calls a lab-only function.

## 2. Tabs

| Tab | Shows | Edits | Backed by |
|---|---|---|---|
| **Research** | A read-only checklist: papers, published 3D models, registered images, nebula type, symmetry, velocity data (long-slit or IFU), chosen method. Each item has a link. | None | `research <id>` writes `src/objects/<id>/source/research.json` |
| **Model** | A preview of the 3D surfaces from the chosen method, with candidate models in **Compare with** | Choose a method (one dropdown) | `model <id> --method=paper\|symmetry\|kinematic` |
| **Edit** | The photograph on the surfaces | A few toggles and sliders, on a working copy. **Save** / **Discard** | `edit`, `save`, `discard` |
| **Bake & publish** | One status row each for verification, files and R2 | Buttons: **Bake**, **Verify**, **Publish** | `bake`, `verify`, `publish` |

Fixed chrome on every tab:

- **Left panel:** camera only. **Earth view · Orbit · Fit · Reset** stay as they are, and **Stars** is added (section 5).
- **Right panel:**
  - **Show:** Model / Original / Starless.
  - **Compare with:** one dropdown listing candidate images and candidate models.
- **Bottom:** the progress strip, showing object · step · % · last log line · result.

UI style:

- Big buttons with labels that can't be misread.
- No paragraphs. Detail goes in the object README or behind an ⓘ link.
- Status is one line.

### Step 3 (four-tab UI): done, 2026-10-08

The lab opens one nebula on four steps, `?step=research|model|edit|bake` on `/reconstruction` (default **Edit**).

- **Research:** the checklist is read from what the object already keeps: its README's Sources section (papers, 3D models, images), its host's classification, its recipe (surfaces, Doppler speed table) and its configured solvers. `research <id>` is still missing, so nothing is written.
- **Model:** method row with ⓘ to the README; **Preview:** Surfaces · Outlines (the published geometry and speeds on the photograph, formerly Show's "Model") · Velocity · Joint fit; the geometry table with its paper as a link; **Compare with**. Solvers come from a new `solvers` entry in `subjects.json`: the Helix has Velocity and Joint fit, M2-9 lists its symmetry experiment (`prepare-emission`, CLI only).
- **Edit:** left panel: Earth view · Orbit · Fit · Reset · Turn 60°, then Annotate · Levels · Radial · Difference. Right panel: Dataset, **Show** (Model / Original / Starless), **Compare with**, Opacity, the working copy (N changes · Save · Discard) and the geometry sliders.
- **Bake & publish:** Git, unsaved changes and R2 rows; Draft bake · Full bake · Verify; the `verify <id>` checks (new `/__nebula/plate-verify`, the CLI's `verifyObject`); files changed; Check R2 · Publish… with a confirmation. Site volumes show their `prepare:nebulae` and `publish:runtime-assets` commands.
- **Removed:** the Catalogue/Alignment/Reconstruction links, the seven-tab viewport strip, the Checkout/Draft toggle, Material and Stars checkboxes, the duplicate Earth view / Turn 60° buttons, and the verbose notes (site-bank paragraphs, candidate and paper notes, the plate legend, the velocity and joint-fit evidence paragraphs). Deleted as unreachable: `EmissionComparison` and the panels only it or the Alignment page mounted (compiler, structures, combined evidence, geometry detection, shape-cloud workbench, observation alignment and sources) with their state modules, and `workspace-sections`.

Deviations:

- The **Stars** toggle (section 5) is not added: it needs `stars <id>` and a star layer for plates.
- The Messier archive page stays reachable at `/catalogue`, linked from Research for Messier objects, instead of being folded into Research.
- **Turn 60°** became a camera button for every object, as the audit suggested.
- Model's method is shown, not chosen: the `model <id> --method=` command does not exist yet.
- Left Alignment and density hosts stay mounted but hidden, because the shared controller still fills them for density objects.

### Step 4 (Research · Model · Stars): done, 2026-10-09

```text
research <id>|--all  → src/objects/<id>/source/research.json        → Research tab (read-only)
model <id> --method  → src/objects/<id>/.local/lab/model/<method>.json → Model tab: Method · Build · Result
stars <id>           → telescope gaia-cone → src/objects/<id>/.local/stars-cone.json → Edit: Stars toggle
every command        → src/objects/<id>/.local/lab/progress.jsonl     → progress strip
```

- **Research:** `research.json` (`cssearth-nebula-research@1`) holds papers, 3D models and images, each with its `src/sources` record when one exists; the nebula type; symmetry; velocity data (Doppler table, long slit, molecular, or spectra the README names); and the chosen method, its status and the methods the data allows.
  - It is gathered, not authored: from the README's Sources rows and their record links, URL and DOI/arXiv matches against `src/sources`, the recipe's geometry `source` ids, the host's classification and the subject's solvers.
  - Filled for the 17 site nebulae: 18 folders, because M1 has a volume and plates.
  - The tab shows four status chips (method and status, 3D model, velocity, symmetry), one row of links per item, and **Run research**.
- **Model:** one **Method** dropdown and **Build**, which runs `model <id> --method …` through the lab server. **Result** replaces the viewport with the result's picture, with its outlines and points drawn in that picture's pixels. Each method keeps its own result, so methods can be compared without rerunning.
  - `paper-surfaces`: reads the recipe (the working copy when there is one). It draws the plates, the published ellipses and measured outlines (Cas A's forward-shock rim), and up to 4,000 rows of the speed table on the photograph. Read-only: Cas A's bank and recipe are untouched.
  - `symmetry`: `prepare-emission`'s fit is now `fitSymmetryRecipe` (`server/workflows/emission-inference/symmetry-fit.ts`), shared by both commands. `methods/symmetry/surfaces.ts` reads the Wenger (2013) fit as a profile e(s, r), and from it a revolved envelope (15% of peak) and wall (brightest radius). It writes `surface.stl` and `surface-recipe.json` (a `geometry.surface` block), and the bake's own `stlTriangles` and `imageLayerSurfaceCrossings` read both in the test. M2-9: 140 axial samples, 56″ long, pole PA 181°.
  - `kinematic`: fits the thin expanding ellipsoid (`forward-model.ts`) to the digitised slit by grid search (inclination, depth ratio, speed; projected radius fixed). For the Helix [O III] slit it gives 74°, 0.65 and 22.5 km/s, with an RMS of 8.1 km/s against 11.6 at the defaults.
- **Stars:** `telescope gaia-cone RA,DEC,RADIUS [--magnitude-limit] [--limit] [--out]` is a new telescope command: one GAVO TAP query of Gaia DR3 joined to Bailer-Jones distances.
  - `stars <id>` takes RA, Dec and distance from the bank frame's origin and asks for the picture's field: 1.5 times the bank's reach on the sky (at most 3°), G < 17. Cas A gets 222 stars, M2-9 3.
  - The lab server puts each star where its sight line crosses the nebula's sky plane, so from Earth it lands where the photograph shows it. The viewer draws them with the site's `mountPreparedCataloguePoints`.
  - Fixed 2026-10-09: the first version kept a sphere of ten times the bank's reach and placed each star at its Gaia distance. That held 7 stars for Cas A, and from the inspection camera, a few bank radii from the nebula, almost all fell behind it or outside its view (Cas A 1 on screen, faded to 0.4%; the Helix 6 of 77), so **Stars** seemed to do nothing.
  - **Stars** (Edit, left tools) runs `stars <id>` when nothing has been fetched yet.
- **Progress:** the strip tails every lab object, not only plates. The new `/__nebula/lab-run` starts only `research`, `model` or `stars` on a configured object.

Deviations and deferred:

- `research` writes the checklist only. Candidate pictures and models in `.local/candidates/` are still `prepare-candidate-models.ts` (Cas A, by hand).
- The symmetry surface is a lab result. Before a bake it still needs a `src/sources` record for Wenger et al. (2013) (`source: wenger-lorenz-magnor-2013` names none yet) and a registered photograph for an image-layer object. The prior's axis lies in the sky plane, so the pole is tipped to 89°, because the bake needs a receding end. Which lobe recedes is not measured.
- `kinematic` fits one digitised slit only. Deferred: the HCO+ joint fit as a `model` input, and a general long-slit or IFU position–velocity fit.
- Paper surfaces trace rings, ellipses, measured outlines and speed tables. A mesh (`surface`) or a density grid is not traced as a silhouette.
- Stars are drawn at a fixed viewing size (2–9 px by G), not the site's physical footprint, and on the sky plane, not at their distances. Stars are not baked into plates. The left Stars toggle is in Edit only and turns off on leaving Edit.
- The pinned M2-9 photograph is no longer served at its APOD URL, which now answers with a web page. The fit refuses a non-image and reads the copy the source manifest pins (`.local/research/wenger/m2-9-original.jpg`), restored here from the main checkout's cache.
- The lab test "measured speeds of Cassiopeia A" now expects the outer knots and jets in both Cas A banks' tables (13,623 rows), as #1509 published them.

## 3. CLI

Every command takes an object id, `<id>` = a `src/objects/<id>` folder, and writes nothing outside that folder except shared caches.

| Step | Command | Today | Gap |
|---|---|---|---|
| Research | `research <id>` | **Done** (step 4): writes `source/research.json`; `--all` fills the 17 site nebulae | Candidate pictures and models into `.local/candidates/` |
| Research | `stars <id>` | **Done** (step 4): `telescope gaia-cone` writes `.local/stars-cone.json` | — |
| Model | `model <id> --method paper-surfaces` | **Previews** (step 4) the recipe's published surfaces on the photograph | A command that writes recipe geometry from a paper table |
| Model | `model <id> --method symmetry` | **Rewired** (step 4): the shared fit emits a revolved surface (STL + `geometry.surface` block). `reconstruct-circumstellar <id>` still builds volumes | The source record and an image-layer object to bake it into |
| Model | `model <id> --method kinematic` | **Started** (step 4): a grid fit of `forward-model.ts` to the object's digitised slit (the Helix) | A general long-slit / IFU position–velocity fit; the joint fit (`joint/fitter.ts`) as an input |
| Edit | `remove-stars <dir>` | Exists, and works for plates | Key it by `<id>` |
| Edit | `edit <id> --set <path>=<value>…` · `diff <id>` · `save <id>` · `discard <id>` | **Done.** Edits (CLI and UI) write `.local/lab/recipe.json`; `save` writes its changed numbers into `source/recipe.json`; `discard` deletes it (`server/workflows/plates/working-copy.ts`) | — |
| Bake | `bake <id> [--draft]` | **Done** for plates: the CLI and the UI's Draft and Bake full call one function (`server/workflows/plates/object-bake.ts`) and write `.local/lab/progress.jsonl`. Volumes use `pnpm prepare:nebulae --object=<id>` | Section 4 divergences 1–3 remain inside that function |
| Verify | `verify <id>` | **Partly done:** bank, inventory against disk, git, unsaved changes and draft (`server/workflows/plates/verify.ts`, shared by the CLI and the server); `verify-nebula` (LMC only) | Render vs photograph numbers (Levels, Radial, Difference) |
| Publish | `publish <id>` | `pnpm publish:runtime-assets --object=<id>` and `pnpm check:assets-published` | A thin alias |

**Working copy.** Everything uncommitted lives in `src/objects/<id>/.local/lab/`: `recipe.json` (the working copy), `draft/` (the draft bank), `jobs/`, `progress.jsonl`. It is already gitignored by the root `.local/` rule.

**Live progress.** Each command appends JSON lines to `.local/lab/progress.jsonl`:

```text
{"job":"…","object":"helix-layers","step":"bake","stage":"prepare-image-layers","fraction":0.4,"line":"…","at":"…"}
… {"job":"…","state":"done|failed|cancelled","result":{…}}
```

- The lab server tails these files and pushes them to the UI, which shows one strip per running job.
- A job the UI starts is the same CLI process, so an agent's run and a click look the same.
- This replaces today's `.local/nebula-lab/*-jobs/` stores.

**Moves out of the UI into the CLI:**

- draft bake
- full bake
- publish
- check R2
- recipe edit, reset and undo
- candidate model preparation
- star fetch
- star removal

The UI keeps buttons for these, and each button runs the command.

## 4. One backend: where the lab bakes differently today

| # | Divergence | Fix |
|---|---|---|
| 1 | The plates job rebuilds `@cssearth/bake`'s `dist` with tsup before each bake, because the site's bake commands import the built dist and a stale dist bakes old code (`server/workflows/plates/bake.ts`) | Fix it in the bake package: its CLIs run from source, or refuse to run when the dist is stale. Then drop the lab's rebuild |
| 2 | The draft bake: the lab's `draftBake()` (`features/plates/plates-paths.ts`) caps the face size and halves the slices, then stages symlinks and a rewritten recipe in `.local/nebula-lab/plates/.staging` | Add a `--draft` option and an output directory to `prepare-image-layers`, so the coarse settings live in `@cssearth/bake` |
| 3 | The full bake: the lab sequences restore → layers → backing → presentation → setup-assets (host and sibling banks) → prepare-objects → verifyInventory itself | Add one site entry, `prepare-object <id>`, that both the lab and `bake <id>` call |
| 4 | Status and verify (`plateStatus`, `verifyPlateBank`) exist only in the lab server | Move them into `@cssearth/objects/node` or `packages/bake` behind `verify <id>` |
| 5 | The volume path: lab solvers (`compile-nebula`, `prepare-emission`, `bake-nebula`, `export-compact-nebula`, `promote-volume-datasets`) write lab results that the site later replays through `prepare:nebulae` | Solvers stay as Model-step tools. Only `prepare:nebulae` / `prepare-object` bakes. New nebulae go through surfaces and plates, not volumes |

## 5. Real stars around any nebula

- **CLI:** `stars <id> [--radius-deg=] [--magnitude-limit=]`. It runs a Gaia DR3 cone search of the picture's field and writes `src/objects/<id>/.local/stars-cone.json`, which holds positions, parallax distances, BP−RP colors and proper motion.
  - The query and the coordinate logic already exist in `packages/bake/cli/prepare-nebula-field-catalogues.mts` (GAVO TAP via `@cssearth/telescope/node` `tapRows`; cache `.local/nebula-lab/stellar-fields/`).
  - **Missing telescope-cli command:** a generic `telescope gaia-cone RA DEC RADIUS [--magnitude-limit] [--out]`. Today `telescope stars` is a SIMBAD/VizieR survey of a galaxy's stars, not a cone search. `stars <id>` should call the new command and take RA, Dec and distance from the object.
- **UI:** one big **Stars** toggle on the left, for every nebula.
  - It draws with the site's own star renderer: the volume dataset bank's `stars.bin` path (`packages/renderer/src/volume/prepared-volume-datasets.ts`), the same one the site uses for `m2-9-volume`.
  - When no stars have been fetched yet, the toggle runs `stars <id>` and shows the progress strip.
  - Plate objects have no star layer today, so the image-layer bank needs to accept the same point set.
- **What M2-9's "independent Gaia field" was:** `src/objects/m2-9-volume/source/stellar-field.json` (7 Gaia stars within 10 pc at 650 pc, G ≤ 14). It was made by `prepare-nebula-field-catalogues.mts` and baked into `stars.bin`, with colors from Cardiel 2021 and sizes from Gaia G. m1, m8, m42 and m45 have the same file.
- **Bake:** stars are viewing context and are not baked into the nebula, unless a later decision says otherwise. The existing `-volume` objects already bake them, and they stay as they are.
- **Workflow step:** Research fetches the stars. Model, Edit and Bake & publish show them through the toggle.

## 6. Audit: UI today

There are 17 site nebulae. M1 has both kinds, so it appears in both lists:

- **Plates (11):** helix, m1-layers, m57, m76, m97, m1-67, ngc-2392, ngc-3132, ngc-7662, cassiopeia-a, homunculus-nebula.
- **Site volumes (7):** m1, m2-9, m8, m42, m45, lmc, smc.

How to read the Used column:

- "Plates" means all 11 plate nebulae.
- "Volumes" means the `siteVolume` entries.
- "None" means unreachable for any of them today. The uncommitted `subjects.json` dropped every `emissionExperiment` and `observationAlignment` entry.

### Pages and viewport tabs

| Item | What it does | Used by the 17 | Step | Verbose text | Verdict |
|---|---|---|---|---|---|
| Catalogue page | Messier archive browser: MAST, IRSA and ESO candidates, plus papers | None directly (Messier list) | Research | Yes: survey and paper notes | **Move to Research** as its data source. Drop the separate page |
| Alignment page | Density footprint, image placement, NOX star removal, Original / Without stars / Residual | None (needs `density` or `observationAlignment`) | Edit | Yes: registration and credit notes | **Move to CLI** (`remove-stars`, registration). Starless view goes to **Show** |
| Section strip (7 tabs) | Rendered for every subject by a stub in `pages/reconstruction/controls.tsx`; only "Model" is enabled, and it does nothing | All, as a dead strip | — | Yes: tooltips | **Remove.** The 4 new tabs replace it |
| Model (`compiler`) | Helix-style compiled 3D emission cloud | None | Model | Yes | **Remove from UI.** Volume cloud, not surfaces. `compile-nebula` stays as a legacy CLI |
| Source candidates | Compares candidate photographs and their sky coverage (Helix JSON) | None | Research | Yes | **Move to Research** (candidate images in **Compare with**) |
| Structures | 2D structure review, geometry detection, shape-hypothesis workbench | None | Model | Yes: many notes | **Move to CLI.** The ridge and geometry detection feeds `model --method=kinematic` |
| Combined | Evidence fusion across registered images | None | Model | Yes | **Move to CLI** as part of `verify` / `model` evidence; no tab |
| Velocity | One digitised long-slit (Helix [O III], Meaburn 2005) vs a thin expanding ellipsoid; hand sliders | None (Helix only) | Model | Yes: 12 paragraphs | **Keep the solver** (`packages/reconstruction/.../kinematics/forward-model.ts`) and **move to Model** as the kinematic preview. Generalise it to real PV / IFU data |
| Joint fit | Grid fit of ellipsoid vs bipolar surfaces to image ridges plus HCO+ velocities, with held-out pointings | None (Helix only) | Model | Yes | **Keep the fitter** (`packages/reconstruction/src/methods/joint/`) and **move to Model**, via `model --method=kinematic` |
| Volume baseline | Three PNGs from an old volume: input, projection, difference | None | Verify | Yes: caveat paragraph | **Remove** |

### Left panel

| Item | What it does | Used | Step | Verbose | Verdict |
|---|---|---|---|---|---|
| Earth view · Orbit · Fit · Reset | Camera | All | All | No | **Keep.** This is the model for the UI style |
| Annotate | Click patches, copy their place, depth and stretch as JSON | All (sky and depth columns only for `sun-icrf`, e.g. Cas A) | Edit | Hint line | **Keep** as a small tool for agents' bug reports |
| Model fieldset / "Fixed prepared model" hint, density tone, cloud density | Density-only sliders | None (no density subjects) | — | Hint text | **Remove** |
| Status line | Loading and errors | All | All | Sometimes long | **Keep**, and fold it into the progress strip |

### Right panel: plates (`PlatesPanel`)

| Item | What it does | Used | Step | Verbose | Verdict |
|---|---|---|---|---|---|
| Lens dropdown | Switches between a nebula's banks (e.g. Helix WFI / VISTA / wide) | Plates and volumes | All | No | **Keep** (becomes the bank picker) |
| Image / Material / Stars / Original checkboxes | Shared appearance row; Material and Stars are always disabled for plates | Plates | Edit | Reasons in tooltips | **Remove** Material. Stars moves to the left toggle. Original folds into **Show** |
| Original · Starless · Model buttons, Opacity | Photograph or model outlines and speed dots on the registered plane | Plates | Edit | Long tooltips and legend line | **Keep** as **Show**, with one-word labels |
| Candidate dropdown | Lab-only comparison pictures from `.local/nebula-lab/candidates` | Cas A only | Research | Yes: field and registration note paragraph | **Move to Compare with.** The note goes behind ⓘ |
| 3D model dropdown, Texture, Earth view / Turn 60°, 153″ shock | Published 3D models (DeLaney and others) textured by a picture | Cas A only | Model | Yes: per-model citation and placement paragraph | **Move to Model.** Models go in **Compare with**; Turn 60° becomes a camera preset; the shock outline stays Cas A-only |
| Checkout / Draft | Shows the committed bank or the coarse draft | Plates | Edit | Status line with timings | **Keep** as the working-copy view (draft = unsaved) |
| Bake full · Cancel | Runs the site's preparation in place | Plates | Bake | Tooltip paragraph | **Move to CLI** (`bake <id>`); the button calls it |
| Reset | `git checkout` of the recipe | Plates | Edit | Tooltip | **Replace** with **Discard** |
| Ready to ship: git, inventory, R2 rows; Check R2; Publish… | Ship status and upload | Plates | Bake | Changed-file list | **Move to Bake & publish**, via the `verify` / `publish` CLI |
| Image credit | Photograph credit | Plates | All | One line | **Keep**, small |
| Published geometry table + paper citation | Plate radius, tilt, PA, depth, and the source paper | Plates | Research / Model | Yes: notes and "What it gives" | **Move:** the table goes to Model, the citation to Research |
| Geometry editor (sliders, Reset geometry, To committed, Undo) | Writes the **tracked** recipe live | Plates | Edit | Header text | **Keep** in Edit, but write `.local/lab/recipe.json` and add Save / Discard |
| Levels · Difference · Radial | Render vs photograph: histograms, a signed difference plane, a radial profile (`/__nebula/site-*`) | Plates and volumes | Verify | Legend lines only | **Keep** in Bake & publish (verify), and expose the numbers through `verify <id>` |

### Right panel: site volumes (`SiteVolumePanel`) and legacy reconstruction panel

| Item | What it does | Used | Step | Verbose | Verdict |
|---|---|---|---|---|---|
| Lens, Original, Opacity | As above | Volumes | Edit | Reasons | **Keep** as **Show** |
| "Site bank · Symmetry · opened in N s" + dataset description + "The prepared volume the site ships…" | Three paragraphs, e.g. M2-9's full model caveat | Volumes | — | **Yes**, the example the owner rejected | **Remove.** Detail goes to the README or ⓘ |
| `ReconstructionControlsPanel` (image picker, processing, image comparison, cloud and star controls) | Density reconstruction workflow | None (hidden for every current subject) | Model | Hints | **Remove** from the UI; the LMC density CLIs stay |

Other verbose text to cut: `kinematics-panel`, `observation-alignment`, `observation-structures`, `catalogue-view`, `emission-sources`, `observation-sources`, `joint-fit-panel`, `shape-cloud-workbench`, `compiler-panel`. Most of these are unreachable already and leave with their tabs.

### Lab-only folders outside `src/objects`

| Folder | What it is | Used by the 17 | Step | Verdict |
|---|---|---|---|---|
| `.local/nebula-lab/plates/<id>/draft`, `plates/.staging`, `plates-jobs/` | Plate drafts and job records | Plates | Edit / Bake | **Move** to `src/objects/<id>/.local/lab/` |
| `src/objects/cassiopeia-a-layers/.local/candidates/` (1.5 GB) | Candidate pictures, raw downloads, candidate 3D models | Cas A | Research | **Move** to `src/objects/cassiopeia-a-layers/.local/candidates/` |
| `src/objects/cassiopeia-a-layers/.local/starless/` | Star-removal output | Cas A | Edit | **Move** to that object's `.local/` |
| `.local/nebula-lab/stellar-fields/` | Gaia cone caches | m1, m2-9, m8, m42, m45, … | Research | **Move** to `src/objects/<id>/.local/` (`stars`) |
| `src/objects/helix-layers/.local/kinematics/`, `planetary/{helix,m2-9}`, `research/` (Helix ALMA, LVM) | Velocity sources, symmetry originals, research data | helix, m2-9 | Model | **Move** to the object's `.local/` |
| `.local/nebula-lab/observations/`, `intake/`, `physical/`, `stellar-catalogues/`, `compiler-published/` (per object) | Observation workspaces and pins | m1, m8, m42, m45, helix | Model | **Move** the site objects' entries to `<id>-volume/.local/`. **Delete** retired ones (carina, horsehead, m78, ngc6357, orion-*, ngc1977, ngc2023) |
| LMC/SMC caches (`lmc-fits`, `smc-*`, `highres`, `particles`, `image-candidates`, `registration`, …) | Density inputs | lmc, smc | Model | **Move** to `lmc-volume/.local/` and `smc-volume/.local/` |
| `.local/nebula-lab/sky-bands/` (12 GB), `compiler/`, `reconstructions/`, `shape-clouds/`, other hash caches, `open-star-removal/`, `compiled/`, venvs | Shared caches and tools (sky-bands is also read by the site build) | Many | — | **Keep** at the root as shared caches |
| `.local/nebula-lab/catalogue/messier/` | Messier catalogue | Research | Research | **Keep** (shared) |
| ~70 `*-check`, `*-review`, `*-browser` folders, loose scripts, logs, `sources/` (Orion), `*-trial/`, `helix-fit-session`, `helix-tuned` | Agent scratch and retired trials | None | — | **Delete** |
| `labs/nebula/models/{helix,m1,m2-9,m8,m42,m45,lmc,smc}/` | Committed recipes and evidence; read by `processing-subjects.json` and cited by the objects' provenance | Yes | Model | **Move** into `src/objects/<id>(-volume)/source/` and fix the citations |
| `labs/nebula/models/{gn-z11,m49,m59,m60,m84–m89,ngc-*}/`, `omega-centauri/` | Galaxy and cluster volume recipes | No (not nebulae) | — | **Move** to each `<id>-volume/source/` |
| `labs/nebula/models/{full-density,magellanic-particles,image-candidates}.json` | LMC/SMC recipes | lmc, smc | Model | **Move** to `lmc-volume/source/` |
| `labs/nebula/models/messier/` | Catalogue recipe | Research | Research | **Keep** in the lab |
| `labs/nebula/models/benchmarks.json` (points at a missing folder), `inference-candidates/` (links to deleted folders) | Dead notes | None | — | **Delete** (or trim inference-candidates to m42 and m8) |
| `labs/nebula/packages/lab/sources/*.json` | Reference image pins | lmc, smc | Edit | **Move** to the `-volume` objects; delete the Orion one |
| `output/cas-a-*` | Cas A fit and texture scripts (`textures.py` feeds the candidate models) | Cas A | Research | **Move** the outputs to Cas A's `.local/`, and the scripts into a `research` / `model` command |

## 7. Data to move (summary): done, 2026-10-09

1. **Committed:**
   - `labs/nebula/models/<id>/` → `src/objects/<id>/source/` for helix, m1, m2-9, m8, m42, m45, lmc and smc (plus the galaxy recipes).
   - Fix the `originalPath`, `replay-references` and `src/sources` citations.
2. **Ignored (per object):**
   - plate drafts and jobs
   - Cas A candidates and starless output
   - Gaia star caches
   - Helix and M2-9 planetary and kinematics data
   - observation workspaces for m1, m8, m42 and m45
   - LMC/SMC caches

   Each goes to `src/objects/<id>/.local/`.
3. **Stays shared:** sky-bands, hash-named solver caches, tools and venvs, the Messier catalogue.
4. **Deleted:** retired targets, agent scratch, dead notes.
5. **Code to update for the move:**
   - `startsWith('.local/nebula-lab/')` guards (in `compiler-published.ts`, `sampled-prior/ownership.ts`, `jobs-model.ts`, the kinematics route)
   - `platesDirectory()`
   - `server/jobs/service.ts`
   - the hard-coded Cas A path in `prepare-candidate-models.ts`

### Data moves: done, 2026-10-09

Of 64 GB under `.local/nebula-lab/`, 14 GB moved into the objects' ignored `.local/` with `mv` on the same disk, 12 GB of retired targets and agent scratch was deleted, and 38 GB of shared caches stayed.

- **Committed models:** the lab's `models/<id>/` folders now sit in each object's `source/`. Helix went to `helix-layers`; m1, m2-9, m8, m42, m45, lmc, smc, omega-centauri and the galaxy recipes went to `<id>-volume`; and the three loose LMC recipes went to `lmc-volume/source/`.
  - A codemod rewrote every path in code, records and docs.
  - `resolveLabModelPath` still reads historical `labs/nebula/models/…` strings.
  - `benchmarks.json` is deleted. `messier/` and the trimmed `inference-candidates/` stay in the lab.
- **Per-object scratch** is now `src/objects/<object>/.local/` (`objectScratch`, `labObjectFolder` and `isLabScratchPath` in `resources/model-paths.ts`). It holds:
  - plate drafts: `.local/lab/draft`, staged in `.local/lab/.staging`
  - Cas A candidate pictures and models: `cassiopeia-a-layers/.local/candidates`, which also serve the MIRI bank
  - Cas A starless output
  - Gaia field caches: `.local/stars`, written there by `prepare-nebula-field-catalogues`
  - Helix kinematics, planetary and research data, and M2-9's Wenger data
  - the observation, intake, physical and stellar-catalogue workspaces, and `compiler-published.json`, for m1, m8, m42, m45, helix and omega-centauri
  - the LMC and SMC caches, including `new-references` and `amateur-candidates`
  - Path guards accept both scratch roots. Absolute symlinks and receipts inside the moved caches were retargeted.
- **Deleted:** the retired targets (carina, horsehead, m78, ngc6357, orion-*, ngc1977, ngc2023, flame-detail) and the Orion `sources/`. Also deleted: the `*-check`, `*-review`, `*-browser` and `*-trial` folders, loose logs, scripts and screenshots, `helix-fit-session`, `helix-tuned` and the unreferenced loose JSON.
- **Kept shared at the root:** sky-bands, compiler, reconstructions, highres (hash-keyed, LMC and SMC mixed), the solver caches, catalogue, source-originals, the tools and venvs, and every `*-jobs` registry.

Deviations:

- `plates-jobs/` stays a server-wide registry. The per-object job record is `.local/lab/progress.jsonl`.
- Object folders hold data only. The Omega Centauri `verify-*.mts` scripts moved to `packages/lab/src/cli/commands/omega-centauri/` and `king-abel-derivation.mts` to `packages/bake/authoring/omega-centauri/`.
- The two CDS ReadMe copies of the Magellanic star catalogues are untracked, because a body cites archive documents. `readPinnedCatalogueFiles` restores them from their pinned URLs.
- The architecture walkers skip `.local/`, because ignored scratch is never committed.
- Docs that cite deleted local receipts (cloud-appearance-check, helix-fit-session) still name them as history.
- `orion-reference.json` stays, because a path test reads it.

