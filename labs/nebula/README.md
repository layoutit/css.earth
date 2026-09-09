# Nebula Lab

Local React tooling for aligning photographs, removing stars and comparing baked 3D clouds. The retained PolyCSS renderer stays in plain TypeScript. The lab is separate from the production website; current objects are **LMC and SMC**.

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula
```

Open [Alignment](http://127.0.0.1:4331/alignment) or [Reconstruction](http://127.0.0.1:4331/reconstruction). Choose the object in the header; camera/density controls are on the left and image/cloud controls on the right.

- **Alignment:** inspect the full density field and registered image footprint. Adjust the saved fit, run automatic NOX removal, and compare Original / Without stars / Residual.
- **Reconstruction:** choose a completed starless source, adjust brightness/gamma/color/detail, then press **Preview**. Settings persist per image. Progress and Cancel are explicit; refresh reconnects to the job. Switching completed sources loads their saved banks at the retained camera pose.
- **Current LMC variants:** ESO VISTA, NASA/IPAC WISE and Horálek optical. They use separate color treatments and an approximate stellar-density depth prior. SMC has prepared density/image models; extending this new reconstruction flow requires its own registered sources and recipe.
- Large originals, native removal products and newly processed volumes stay in the ignored local cache. Processing does not publish or replace production assets.

```text
labs/nebula/
├── AGENTS.md             # Usage, ownership and development boundaries
├── METHOD.md             # Repeatable scientific/processing method
├── docs/                 # Current workflow and archived research
├── src/
│   ├── components/       # React UI
│   ├── alignment/        # Registration and saved image placement
│   ├── star-removal/     # Automatic NOX pipeline
│   ├── reconstruction/   # Volume model, worker and saved variants
│   ├── density/          # Full prior and cutoff preparation
│   ├── stars/            # Catalogue and particle tooling
│   ├── viewer/           # Retained TypeScript PolyCSS scene
│   ├── utils/            # Jobs, stores and shared utilities
│   ├── cli/              # Offline preparation commands
│   └── browser/          # Browser checks
├── models/
│   ├── lmc/              # LMC recipes, evidence and prepared models
│   └── smc/              # SMC recipes, evidence and prepared models
└── sources/              # Acquisition metadata and credits
```

Start with [the workflow](docs/workflows.md), [processing method](METHOD.md), or [documentation index](docs/README.md). Source/registration evidence and prior failed experiments remain accessible without adding more UI tabs.
