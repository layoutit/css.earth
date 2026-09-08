# Nebula Lab

Local tooling for inspecting galaxy and nebula reconstructions with the actual PolyCSS renderer. Drag to rotate, scroll to zoom, inspect individual layers, and compare source images. The lab is separate from the website.

```text
labs/nebula/
├── README.md
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

Open <http://127.0.0.1:4331/> or the [high-resolution LMC candidate](http://127.0.0.1:4331/?subject=lmc-highres-1024&tab=reconstruction). Other catalogue subjects require their prepared assets to be present; the viewer does not acquire or bake them.

- **[Alignment](http://127.0.0.1:4331/?subject=lmc-particles&tab=alignment)**: rotate the LMC/SMC simulated stellar field, compare six LMC references in the floating right panel; adjust neutral density in the floating left panel. Brightness, gamma, black/white levels, and image alignment controls stay visible. Shared inspection controls live in the header. The default camera is at the solar observer. Fits survive reloads. [Preparation and limitations](docs/workflows.md#independent-density-and-image-overlays).
- **[Reconstruction](http://127.0.0.1:4331/?subject=lmc-clouds&tab=reconstruction)**: inspect the colored 3D cloud made from registered image structure and the stellar density prior. The connected LMC cloud has a floating panel for individual structures, diffuse/compact light, Solo, and source-signal accounting. Overall and X/Y/Z brightness controls attenuate the finished view, blending smoothly during rotation. [Cloud controls](docs/cloud-inspection.md) · [Method and limits](docs/filled-observation.md).
- [Research plan](docs/research-plan.md): image decomposition, coherent local depth, sampling controls, scientific sources and acceptance criteria. First target: Tarantula.
- [Automatic structure benchmark](docs/structure-benchmark.md): native Tarantula crop, wavelet/getsf comparisons, retained residuals and detected structures. Its panels and recipes remain research files; it has no separate lab tab.
- [Repeatability and coherent depth](docs/coherent-depth.md): the same code on Tarantula and Orion, paired 3D controls, measured coverage and the current morphology limit.
- [Registration evidence](docs/registration.md): published simulation placement, image WCS and the remaining model/observation mismatch.
- [Workflows](docs/workflows.md): inspection controls, complete preparation commands and existing experiments.
- [Source references and credits](sources/README.md): image provenance and registration constraints.

All reconstruction, geometry and image processing happen offline. Runtime uses retained CSS geometry and fixed prepared textures. Large source originals and intermediate masters stay in the ignored local cache; recipes, provenance and small delivery banks are committed. General algorithms belong in `src/`; object-specific choices belong in data recipes.
