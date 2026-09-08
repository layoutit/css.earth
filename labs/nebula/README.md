# Nebula Lab

Local tooling for inspecting galaxy and nebula reconstructions with the actual PolyCSS renderer. Drag to rotate, scroll to zoom, and compare source images. The lab is separate from the website.

```text
labs/nebula/
├── README.md
├── METHOD.md                # Repeatable acquisition → alignment → separation → bake gates
├── docs/
│   ├── research-plan.md     # Tarantula reconstruction experiments and gates
│   └── workflows.md         # Sources, rebuild commands and model limitations
├── src/                     # Viewer, offline preparation, tests and styles
│   └── subjects.json        # Lab subject catalogue
├── models/                  # Experiment recipes and prepared candidates
├── sources/                 # Reference images, acquisition recipes and credits
│   └── index.json           # Source catalogue
├── index.html
├── tsconfig.json
└── vite.config.ts
```

From the repository root, to inspect the checked-in LMC/SMC candidates:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula
```

Open <http://127.0.0.1:4331/>. The header selects LMC, SMC or Milky Way and the inspection tab. Camera controls share the left sidebar with density adjustments; image and reconstruction adjustments stay on the right. Earlier experiment records remain available to offline tooling. Milky Way opens its prepared reconstruction because it has no separate alignment density field. The viewer does not acquire or bake objects.

- **[Alignment](http://127.0.0.1:4331/?subject=lmc-clouds&tab=alignment)**: compare the current SMASH source, VISTA infrared, WISE infrared, DSS2 optical, Horálek optical, the wider SMASH survey mosaic, Ciel Austral optical and the available Naztronomy optical preview over the complete simulated stellar field. The image catalogue can grow independently of reconstruction. Importing and aligning candidates does not select them for processing; only a source explicitly approved by the user proceeds to cloud processing. Visible tone and placement controls remain in the floating sidebars. VISTA, Horálek and WISE are selected for 2D separation trials after verified alignment; a new 3D bake follows a separate inspection decision. [Candidate sources and gates](docs/image-candidates.md).
- **[Reconstruction](http://127.0.0.1:4331/?subject=lmc-clouds&tab=reconstruction)**: inspect the colored 3D cloud. The left panel removes faint regions using a fixed Earth-facing projection, with soft edges and a removed-signal preview. The right panel controls structures, diffuse/compact light, brightness, and a separate layer of 943 [published LMC stars](models/lmc-stars/README.md). [Cloud controls](docs/cloud-inspection.md) · [Viewing-direction color](docs/view-direction-color.md) · [Method and limits](docs/filled-observation.md).
- [Processing method](METHOD.md): reusable stages, native-pixel preservation, alignment gates, star separation, depth limits and replay records.
- [Research plan](docs/research-plan.md): image decomposition, coherent local depth, sampling controls, scientific sources and acceptance criteria. First target: Tarantula.
- [Automatic structure benchmark](docs/structure-benchmark.md): native Tarantula crop, wavelet/getsf comparisons, retained residuals and detected structures. Its panels and recipes remain research files; it has no separate lab tab.
- [Repeatability and coherent depth](docs/coherent-depth.md): the same code on Tarantula and Orion, paired 3D controls, measured coverage and the current morphology limit.
- [Registration evidence](docs/registration.md): published simulation placement, image WCS and the remaining model/observation mismatch.
- [Workflows](docs/workflows.md): inspection controls, complete preparation commands and existing experiments.
- [Source references and credits](sources/README.md): image provenance and registration constraints.

All reconstruction, geometry and image processing happen offline. Runtime uses retained CSS geometry and fixed prepared textures. Large source originals and intermediate masters stay in the ignored local cache; recipes, provenance and small delivery banks are committed. General algorithms belong in `src/`; object-specific choices belong in data recipes.
