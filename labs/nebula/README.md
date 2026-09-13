# Nebula Lab

Local React tooling for aligning photographs, removing stars and comparing baked 3D clouds. The retained PolyCSS renderer stays in plain TypeScript. The lab is separate from the production website; objects include **LMC/SMC**, [M2–9](models/m2-9/README.md), [Helix](models/helix/README.md) and [six irregular nebula candidates](models/inference-candidates/README.md). Image-to-volume experiments have explicit preparation commands and unmeasured-depth assumptions.

The [Helix compiler](docs/emission-compiler.md) turns three registered ESO observations into one conditional 3D emission cloud with three image lenses. **Reconstruction → Nebula → Compile nebula** restores the required inputs and runs the pipeline. Detail, faint-emission and depth controls update automatically after the first successful compile. The final cloud is the main view; alignment, structures and velocity comparisons remain diagnostics. Visual acceptance is still open.

The shell is shared across three configured methods: **Density model** (LMC/SMC), **Symmetry** (M2–9), and **Constrained inference** (Helix and the [six irregular nebula candidates](models/inference-candidates/README.md)). Objects select a method and supply recipes; shared registration, star separation and viewing tools remain object-agnostic. The compiler's depth and compact-light placement are model assumptions. Its older Hubble-based volumes remain failed comparison baselines.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm lab:nebula
```

Open [Alignment](http://127.0.0.1:4331/alignment) or [Reconstruction](http://127.0.0.1:4331/reconstruction). Choose the object in the header; camera/density controls are on the left and image/cloud controls on the right.

The separate [archive catalogue](docs/archive-catalogue.md) browses MAST, IRSA and ESO candidates for all 110 Messier objects. It retains wide views and local detail fields without starting image processing or changing the cloud workspace.

[Pleiades, Crab and Lagoon source candidates](docs/source-candidates.md) are ready for Alignment inspection: six spectral images and five papers per object. Publisher-only placements stay explicitly provisional; no candidate processing or new reconstruction is implied.

For the compiler's complete clean-state setup, including the pinned NOX environment/model and an offline compile, use [Compile an emission nebula](docs/emission-compiler.md#reproduce-from-a-clean-checkout).

- **Alignment:** inspect the full density field and registered image footprint. Adjust the saved fit, run automatic NOX removal, and compare Original / Without stars / Residual.
- **Nebula:** compile once, then adjust Detail, Faint emission and Depth. Lens, Neutral/Textured, Stars, Original and camera changes load or display prepared state without baking. Progress, Cancel, Retry, settings and refresh reconnection are retained.
- **Density reconstruction:** choose a completed starless source, adjust brightness/gamma/color/detail, then press **Preview**. Settings persist per image. Progress and Cancel are explicit; refresh reconnects to the job. Switching completed sources loads their saved banks at the retained camera pose.
- **Current LMC variants:** ESO VISTA, NASA/IPAC WISE and Horálek optical. They use separate color treatments and an approximate stellar-density depth prior. SMC has a neutral density model; extending this new reconstruction flow requires its own registered sources and recipe.
- Large originals, native removal products and newly processed volumes stay in the ignored local cache. Neutral density slices and inspection/reference images regenerate at lab startup (missing native originals are downloaded). Extraction previews and production LMC slice textures are also ignored; the full bake restores them against saved hashes. Interactive lab processing does not publish or replace production assets.

The LMC image catalogue contains only **ESO VISTA, Horálek optical and NASA WISE**. Retired image candidates and experimental render banks are removed. Reconstruction starts with the unpainted density reference when no saved result is selected. SMC retains its density field for future work.

Keep the shared density, star catalogue and calibration inputs: they reproduce the selected results. The historical SMASH target is regenerated from its pinned native observation; its recipe and coordinate receipts are star-preparation evidence, not selectable color sources. Research notes remain under `docs/research`; superseded render assets are recoverable from Git history before this cleanup.

```text
labs/nebula/
├── AGENTS.md             # Usage, ownership and development boundaries
├── METHOD.md             # Repeatable scientific/processing method
├── docs/                 # Current workflow and archived research
├── src/
│   ├── components/       # React UI
│   ├── catalogue/        # Archive discovery, receipts and metadata browser
│   ├── alignment/        # Registration and saved image placement
│   ├── star-removal/     # Automatic NOX pipeline
│   ├── pipeline/         # Reproducible command and stage orchestration
│   ├── reconstruction/   # Volume model, worker and saved variants
│   ├── density/          # Full prior and cutoff preparation
│   ├── stars/            # Catalogue and particle tooling
│   ├── delivery/         # Pinned lab results and sky frames for app volumes
│   ├── viewer/           # Retained TypeScript PolyCSS scene
│   ├── utils/            # Jobs, stores and shared utilities
│   ├── cli/              # Offline preparation commands
│   └── browser/          # Browser checks
├── models/
│   ├── lmc/              # LMC recipes, evidence and prepared models
│   ├── smc/              # SMC recipes, evidence and prepared models
│   └── messier/          # Discovery catalogue and its source evidence
└── sources/              # Acquisition metadata and credits
```

Rebuild the selected sources with **`pnpm lab:nebula:bake`**, then check them with **`pnpm lab:nebula:verify`**. See [baking](docs/baking.md) for prerequisites, stages, saved settings and outputs.

Start with [next steps](NEXTSTEPS.md), [research and papers](RESEARCH.md), [the workflow](docs/workflows.md), [processing method](METHOD.md), or [documentation index](docs/README.md). Source/registration evidence and prior failed experiments remain accessible without adding more UI tabs.
