# Rebuild nebula assets and research results

For the ordinary app bake, use the [compact-input installation](../../../docs/nebulae/README.md#reproduce-from-a-clean-checkout). It enters through `tools/nebula/prepare.mts` and the private volume-bake package. It needs Node/pnpm and no original observations, simulation archives, NOX or Python. The sections below describe the optional full research replay; its native-artifact verifier intentionally expects research caches.

Requires **Node 22, pnpm 10.33.0 and Python 3.9–3.12** with `venv`/`pip`, plus internet access and free disk space for the native images, Python environment and results. The pinned TensorFlow release needs a wheel for your OS/CPU. The [clean-install verification](clean-install-verification.md) records the platform actually tested; it is not a claim that every platform produces identical bytes.

## Full research processing environment

From the repository root in a clean checkout, this complete setup prepares the prerequisites for `prepare-observations` and `compile-nebula`. For a new environment, `python3` on `PATH` must be Python 3.9–3.12 with `venv` and `pip` available.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/run.mts prepare-processing-environment
```

The environment command reads the canonical Python/package and NOX model pins from `models/lmc/bake.json`, creates or verifies `.local/open-star-removal/venv`, and downloads only a missing model. Success requires **`ENVIRONMENT_READY pinned Python packages and NOX model`** followed by **`NOX_MODEL_VERIFIED`** with its SHA-256. A ready environment is reused without reinstalling packages; an altered model fails while preserving its existing bytes. This command prepares no object images, density fields or baked assets.

Use `--python=/absolute/path/to/venv/bin/python` to verify an existing environment without modifying its packages. The same pinned model is still required. The environment-only command was verified against the existing macOS environment on 2026-09-13; this check is not a new clean-cache installation test.

## Rebuild the saved LMC batch

From a new temporary clone, run this complete sequence. The published LMC recipe is available on the default branch:

```sh
nebula_dir="$(mktemp -d "${TMPDIR:-/tmp}/cssearth-nebula.XXXXXX")"
git clone --depth 1 --single-branch https://github.com/layoutit/css.earth.git "$nebula_dir"
cd "$nebula_dir"
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/run.mts bake-nebula --research
node --experimental-strip-types labs/nebula/run.mts verify-nebula
```

`--ignore-scripts` avoids the repository-wide postinstall preparation. Building the shared packages supplies the libraries needed by the lab. Only shared packages and nebula assets are built; the bake runs without a browser or GPU server.

Success is **`BAKE_COMPLETE lmc` followed by `NEBULA_VERIFIED`**. The verifier checks the complete native-removal artifacts, saved placement/material settings, shared cloud geometry and catalogue stars, assembled lens-bank manifest, and accepted application textures. It only reads files: a missing or altered output fails without repairing it. The current recipe produces three LMC variants (VISTA, Horálek and WISE), 288 neutral LMC/SMC slices, 432 colored LMC slices, three image previews, six extraction previews and 943 shared stars. SMC gets its neutral density field; it has no accepted color reconstruction yet.

The bake downloads missing native originals and the pinned NOX model, creates a local Python environment with pinned dependencies, and verifies hashes before processing. Large downloads and intermediate files stay in `.local/`. Allow at least 8 GiB beyond the clone for dependencies, originals and generated products. The measured clean run took **15 minutes** on macOS arm64, including downloads and Python setup; a cached full replay took **4.2 seconds**. Hardware and network speed affect these times. The saved pre-NOX baseline examines about 1.7 million VISTA candidates and dominates the first run. Later runs verify and reuse completed native removal/reconstruction results. Python package installation requires an available wheel for the machine's platform.

The command does not need the browser's localStorage, a running server or previously completed image jobs. A full bake assembles its three-lens repaint bank under `.local/nebula-lab/bakes/` only: the application LMC now ships the finite-emission model in `models/lmc/envelope/`, restored by `pnpm prepare:nebulae` from `src/objects/lmc/source/compact/`, so this recipe no longer writes into `src/objects/lmc`. It does not restart the lab, change browser settings or publish anything.

## Stages and configuration

| Stage | Source of truth | Result |
|---|---|---|
| Density | LMC/SMC scalar grids, physical frames and volume recipes | The same 144 neutral slices per object; geometry and pixel hashes verified |
| Images | Three native originals, historical SMASH calibration, source hashes and accepted registration metadata | Full-footprint inspection previews; sky registration is preserved |
| Removal | Saved baseline recipes, pinned NOX script/model and Python versions | Native starless image, residual and mask with exact subtraction checks |
| Reconstruction | Shared density, catalogue/sky reference, saved placement and RGB controls | XYZ cloud banks plus the same 943 modeled catalogue stars for every image |
| Lens bank | Saved cutoff, axis brightness, enabled cloud contributions, star exposure/size | A local three-lens repaint bank (historical; no longer the app delivery) |

`models/lmc/bake.json` is the entry recipe. It records the accepted ESO VISTA, Horálek optical and NASA WISE placements and saturation, detail strength/scale, brightness and gamma. It references the existing source/alignment, baseline, catalogue and presentation recipes by hash. The historical result IDs in `app-lenses.json` are replaced with the newly produced IDs during replay; the recorded presentation settings remain unchanged. Re-running the full bake verifies and reuses completed stages, then refreshes its receipt. Re-running `node --experimental-strip-types labs/nebula/run.mts verify-nebula` checks the results without processing.

The accepted NOX images include an earlier compact-source baseline through a positive-residual union. This command **requires and reproduces that baseline**; omitting it would change the accepted pixels. The older interactive calibration UI is not restored. Reconstruction never runs star removal again.

The scalar grids and existing catalogue measurements are the pipeline's scientific inputs. This command does not rerun the N-body simulation or reacquire its multi-gigabyte snapshots. It reconstructs catalogue positions from the configured sky reference and density, independently of the chosen color image. The simulation prior remains an approximation to stellar density, not measured gas/dust depth.

## Options

Options with values use `--name=value`. Stages include their preceding dependencies and reuse verified completed results.

Image-filtered bakes require `--research`, for example `node --experimental-strip-types labs/nebula/run.mts bake-nebula --research --image=wise-wide-infrared`. Without it, the command rejects the filter before reading recipes or starting processing. A full bake also requires `--research`: this recipe has no compact application delivery any more, so there is nothing to replay without processing.

| Option | Purpose |
|---|---|
| `--research` | Use the original processing route; required with `--image` |
| `--stage=density` | Offline neutral fields only |
| `--stage=assets` | Neutral fields and inspection/reference images; used by lab startup/tests, without Python or star removal |
| `--stage=removal` | Stop after native baseline/NOX products and separation previews |
| `--stage=reconstruction` | Stop after individual cloud variants |
| `--stage=all` | Default; also assemble the local lens bank and restore configured app textures; requires `--research` |
| `--if-missing` | Verify the complete app delivery of a recipe that has one; bake only if textures are absent. Cannot combine with an image filter or partial stage |
| `--image=wise-wide-infrared` | Process just one configured image; also accepts `vista-infrared` or `horalek-widefield` |
| `--recipe=<json>` | Select an explicitly configured source set |
| `--python=<executable>` | Use an existing environment; verify package versions without modifying it |

This fixed-density command supplies the three historical LMC repaint comparisons. SMC supplies only its neutral density field. The six Galactic nebulae use separate saved compiler/symmetry delivery recipes; [the shared app guide](../../../docs/nebulae/README.md) documents all 23 lenses and their different scientific limitations. New objects require their own approved source/registration/prior configuration.

For the separate production environment assets (outside this nebula-only workflow), `pnpm prepare:environment-images` restores the M31/M33/SMC layers, Milky Way slices and sky faces, heliosphere atlas and stellar point atlas from their pinned sources. It only bakes missing banks and verifies every restored byte against the accepted resource manifests. Pass `--verify-replay` to independently rebake even a complete bank. These operations preserve the descriptors and saved rendering settings. App startup/build and universe CI restore these images automatically.

`pnpm prepare:nebulae` invokes the application-only entrypoint with `--if-missing`. It restores accepted compact inputs without Python, native observation downloads or the lab CLI. The full research verifier still requires native research caches. A changed pinned input is an error, not permission to silently replace it. Application startup and build behavior is documented in [the app guide](../../../docs/nebulae/README.md).

## Code ownership and separate gates

The research runner is `labs/nebula/run.mts`. Density stage orchestration lives in `packages/lab/src/server/workflows/density`; scientific operations use reconstruction, while deterministic replay uses volume-bake and volume-core. Runtime never performs scientific fitting or bakes textures. [Package validation](internal-packages.md) distinguishes the cache-independent CI job, artifact-dependent lab/browser checks and the explicit cold replay gate. A passing unit suite is not a clean-install or visual-acceptance result.

## Files and recovery

```text
models/
  lmc/bake.json                    tracked stage recipe and accepted settings
  {lmc,smc}/full-density/source/   tracked compact density grids and provenance
  {lmc,smc}/full-density/prepared/
    *.json                        tracked reference geometry and resource hashes
    slices/                       ignored, regenerated textures
  lmc/candidates/                 tracked registration and expected preview hashes
    prepared/*.webp              ignored, regenerated inspection previews
  lmc/clouds-observation/source/
    target.png                    ignored, regenerated historical star-calibration panel
  lmc/stars/                      tracked catalogue input and sky-to-model reference
  lmc/star-separation/
    *.json, receipts/             tracked extraction configuration and reference hashes
    prepared/                     ignored, regenerated starless/residual previews
src/objects/*/
  prepared/**/*.webp, *.png       ignored, regenerated runtime images
  object.json, source/, prepared/*.json
                                 tracked descriptor, settings and delivery manifest
.local/
  open-star-removal/              downloaded model and Python environment
  nebula-lab/
    star-separation/              native baseline products
    star-removal-nox-applied/      verified native NOX results
    reconstructions/              individual material banks, stars and manifests
    bakes/
      lmc-all.json                latest completed command receipt
      lmc-<hash>/                 assembled local lens bank
```

Reference metadata stays versioned. Every derived lab image, including the three original-image inspection previews and historical SMASH star-calibration panel, is regenerated. Lab startup runs the assets stage: it restores density and inspection/reference images, acquiring missing originals, without running NOX or reconstruction. The six starless/residual previews and production slice images also remain untracked. Until extraction previews exist, Alignment offers the originals; completed removal jobs supply their own verified layers. The bake can recreate all these previews from the native originals.

`BAKE_COMPLETE` is printed only after validating the output. The receipt identifies the recipe hash, source/result IDs and final output directory. Full lens-bank manifests pin every delivered file. App delivery preserves the checked-in metadata and restores texture bytes only after checking the whole selected set against its manifest. A failed stage exits nonzero and leaves the previous completed results intact. Source mismatches are errors, never silent replacements.

One command can own a recipe at a time. An ordinary failure or Ctrl-C releases its lock. After a hard machine/process crash, inspect `.local/nebula-lab/bakes/lmc.lock/owner.json` and remove that lock only after confirming its PID is no longer running. Re-run the same command; verified completed removal/reconstruction stages are reused. An incomplete or altered saved result is reported rather than treated as a successful cache hit.

Current rendering limitations, including oblique brightness changes and the simulation/observation offset, remain documented in [slice stability](slice-stability.md) and [next steps](../NEXTSTEPS.md). Successful replay establishes reproducibility, not new scientific or visual accuracy.
