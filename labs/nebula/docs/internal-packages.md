# Internal packages and validation

The lab and its scientific libraries are five private pnpm workspace packages inside this repository. They use source TypeScript exports and are not published. Recipes, historical receipts and scientific distinctions remain source-owned; moving code does not qualify a new physical model or visual result.

## Ownership

```text
lab
├── reconstruction ── volume-core
├── volume-bake ───── volume-core
├── volume-viewer ─── volume-core
└── volume-core
```

Each branch means an allowed import. Reconstruction, baking and viewing do not import one another. The lab coordinates them through explicit package APIs.

| Package | Responsibility |
| --- | --- |
| `@cssearth/nebula-lab` | One React application tree, pages and control portals; saved sessions; jobs, routes, workers, research commands and host adapters |
| `@cssearth/volume-core` | Validated contracts, units/frames, coordinates, fields, sampling and material operations without filesystem or browser dependencies |
| `@cssearth/volume-bake` | Replay accepted compact inputs; deterministically sample, encode and verify prepared images through explicit host backends |
| `@cssearth/nebula-reconstruction` | Configured acquisition, registration, separation, image evidence and scientific fitting |
| `@cssearth/volume-viewer` | Retained scene lifecycle, camera and inspection through an injected renderer; prepared assets only |

The app owns object selection and processing decisions. React owns controls and their visibility; its rerenders retain the plain TypeScript scene. Direct integration with cssEarth renderer, preparation and source internals belongs in `packages/lab/src/adapters`. Imports between packages use public exports rather than private source paths. Authored source files have a 600-line limit.

The local `labs/nebula/nebula_lab_refactor.md` plan records remaining migration work and verification. Authored code owners now live under `packages/`; historical source paths are resolved at loading boundaries without changing receipt bytes. The plan distinguishes completed moves from remaining verification.

## Application replay and research are separate entrypoints

| Entry | Scope |
| --- | --- |
| `tools/nebula/prepare.mts` | Application delivery from source-owned compact inputs; `--if-missing` verifies or restores prepared outputs; `--object=<id>` selects one registered delivery |
| `labs/nebula/run.mts` | Explicit named research commands, processing environment setup, lab verification and test discovery |
| `packages/lab/src/cli/commands.ts` | Research command registry; unknown commands fail |
| `packages/lab/browser/` | Actual browser checks and isolated browser regression helpers |

`pnpm prepare:nebulae` uses the application entrypoint and prepares source cards through the existing app command. It needs no lab server, native observation downloads, Python, NOX or scientific fitting. The [app guide](../../../docs/nebulae/README.md) gives the complete installation sequence.

`node --experimental-strip-types labs/nebula/run.mts bake-nebula --research` selects the saved native LMC processing workflow. Lab startup and `pnpm test:lab:nebula` first run the assets stage, which can acquire missing original images. Those commands are therefore separate from the cache-independent CI job. See [baking](baking.md) for native prerequisites and [workflows](workflows.md) for the interactive app.

## Application dependency boundary

| Consumer | Allowed nebula dependencies |
| --- | --- |
| Browser/runtime | Explicitly erased public `volume-core` types only; no package runtime implementation |
| Application preparation | Public `volume-core` and `volume-bake` exports |
| Research workspace | The five private packages, through their declared public exports |
| Tests | Public package APIs; tests cannot act as wrappers that bypass production restrictions |

The inbound guard traces imports through local wrappers, resolves static imports, re-exports, module loaders and TypeScript aliases, and rejects direct lab source paths. It also rejects statically resolvable filesystem reads into the lab. Computed module loading is rejected in compact application preparation and nebula-bearing loaders. It is not a general proof about arbitrary opaque plugin loaders.

Application bake fingerprints resolve package-owned implementation inventories through public package manifests. Moving those packages does not change identity; changing their implementation does. The host does not assume their location under this lab.

Current manifests and presentation recipes use object-owned source evidence. Historical receipts retain their original paths, revisions and hashes; source catalogue statements link to those pinned revisions. Historical metadata does not require the current lab files to exist.

### Isolated application delivery proof

This bounded gate bundles the actual application preparation entrypoint, copies declared object inputs, relocates only core/bake, and provides no lab tree. A filesystem guard blocks lab reads and `fetch` is disabled. It bakes M42 (compiler), M2–9 (symmetry) and LMC (density), verifies resource hashes, then repeats each with `--if-missing`. LMC retains its manifest-pinned lens metadata; no prepared images are supplied. Each invocation has a three-minute deadline. This proves these three delivery paths, not every scientific reconstruction.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r --filter "./packages/**" build
node tools/nebula/application-isolation.gate.ts
```

Logs and the resolved implementation closure are written under ignored `output/nebula-application-isolation/`. The gate is separate from routine unit discovery because it generates real atlases.

## Routine CI

The `nebula` job in [the maintained workflow](../../../.github/workflows/universe.yml) installs dependencies with lifecycle scripts disabled, builds shared TypeScript dependencies, typechecks all five packages and test roots, checks dependency boundaries, and runs an explicit small test selection. It installs Chromium because the portal and browser-helper tests open real isolated browser contexts.

The selected tests exercise numerical fields/materials, stellar registration, archive metadata rules, durable jobs and interruption/cancellation, plugin construction, latest-only scheduling, React context/state retention, retained-node probes and blocked writes. Their data is checked-in small metadata or generated temporary fixtures; they do not require a running lab, native originals, a NOX model or generated nebula textures. The boundary checker also has mutation tests for forbidden imports and platform dependencies.

From a clean source checkout, reproduce the job's exact maintained commands:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check:ci --job=nebula
```

The local runner reads the workflow; it does not maintain a second unit-test selection. Installation and Chromium setup require network access. This command checks the selected code and tests; it does not establish visual acceptance, native-processing reproducibility or full application delivery parity.

## Artifact-dependent checks

The complete lab suite includes real density geometry, prepared imagery, source registrations and saved native caches. `pnpm test:lab:nebula` restores the assets stage first. Some tests additionally require the specific completed research fixtures named in their source; missing fixtures must be reported rather than replaced with fabricated results.

The saved-output `browser-candidate-published` command checks real M42/M45 lens switching, actual retained scene nodes, delayed bitmap decoding, source races and camera/lens/toggle settings after refresh. It installs its write guard before navigation and uses a fresh browser context. Screenshots are evidence for inspection, not an automatic visual-acceptance assertion. Other browser commands may deliberately process data; inspect their prerequisites and authorization before running them.

The historical multi-part LMC control gate requires a compatible multi-part saved result. A neutral LMC controls check or a single-part reconstruction does not satisfy that material/solo-control gate. Keep that fixture gap explicit.

## Explicit cold replay

The bounded cold gate is deliberately outside routine unit-test discovery. It runs selected compiler/sampled deliveries in isolated temporary roots with declared compact inputs and a per-object deadline, then checks fields, stars, frames, lenses and output bytes. Its current object set is M42, Helix, M45, M8 and M1; it is not an all-seven-delivery claim. LMC and M2–9 use their separate density/symmetry replay paths and checks.

From a clean source checkout with the tracked compact delivery inputs:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r --filter "./packages/**" build
node labs/nebula/packages/lab/src/adapters/application/delivery/run-cold-replay.mts --timeout-seconds 1800
```

Use `--objects m42,helix` to bound an explicitly selected run. A cold gate pass establishes parity for the inputs and code actually tested, not a new scientific interpretation. Record the tested revision, platform, selected objects and complete result before claiming clean-install success. Existing [clean-install evidence](clean-install-verification.md) remains tied to its recorded historical revision and environment.
