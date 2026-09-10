# Rebuild the accepted nebulae

Requires **Node 22, pnpm 10.33.0 and Python 3.9–3.12** with `venv`/`pip`, plus internet access and free disk space for the native images, Python environment and results. The pinned TensorFlow release needs a wheel for your OS/CPU. The [clean-install verification](clean-install-verification.md) records the platform actually tested; it is not a claim that every platform produces identical bytes.

From a new temporary clone, run this complete sequence. It targets the PR branch while the change awaits merge:

```sh
nebula_dir="$(mktemp -d "${TMPDIR:-/tmp}/cssearth-nebula.XXXXXX")"
git clone --depth 1 --single-branch --branch feat/local-group https://github.com/layoutit/cssEarth.git "$nebula_dir"
cd "$nebula_dir"
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm lab:nebula:bake
pnpm lab:nebula:verify
```

`--ignore-scripts` avoids the repository-wide postinstall preparation. Building the shared packages supplies the libraries needed by the lab. Only shared packages and nebula assets are built; the bake runs without a browser or GPU server. After this branch merges, use the merged branch in the clone command.

Success is **`BAKE_COMPLETE lmc` followed by `NEBULA_VERIFIED`**. The verifier checks the complete native-removal artifacts, saved placement/material settings, shared cloud geometry and catalogue stars, assembled lens-bank manifest, and accepted application textures. It only reads files: a missing or altered output fails without repairing it. The current recipe produces three LMC variants (VISTA, Horálek and WISE), 288 neutral LMC/SMC slices, 432 colored LMC slices, three image previews, six extraction previews and 943 shared stars. SMC gets its neutral density field; it has no accepted color reconstruction yet.

The bake downloads missing native originals and the pinned NOX model, creates a local Python environment with pinned dependencies, and verifies hashes before processing. Large downloads and intermediate files stay in `.local/`. Allow at least 8 GiB beyond the clone for dependencies, originals and generated products. The measured clean run took **15 minutes** on macOS arm64, including downloads and Python setup; a cached full replay took **4.2 seconds**. Hardware and network speed affect these times. The saved pre-NOX baseline examines about 1.7 million VISTA candidates and dominates the first run. Later runs verify and reuse completed native removal/reconstruction results. Python package installation requires an available wheel for the machine's platform.

The command does not need the browser's localStorage, a running server or previously completed image jobs. A full bake also restores the app's ignored LMC slice textures, matching the accepted delivery hashes. It does not restart the lab, change browser settings or publish anything.

## Stages and configuration

| Stage | Source of truth | Result |
|---|---|---|
| Density | LMC/SMC scalar grids, physical frames and volume recipes | The same 144 neutral slices per object; geometry and pixel hashes verified |
| Images | Three native originals, historical SMASH calibration, source hashes and accepted registration metadata | Full-footprint inspection previews; sky registration is preserved |
| Removal | Saved baseline recipes, pinned NOX script/model and Python versions | Native starless image, residual and mask with exact subtraction checks |
| Reconstruction | Shared density, catalogue/sky reference, saved placement and RGB controls | XYZ cloud banks plus the same 943 modeled catalogue stars for every image |
| Lens bank | Saved cutoff, axis brightness, enabled cloud contributions, star exposure/size | A local three-lens bank and the app's 432 accepted slice textures |

`models/lmc/bake.json` is the entry recipe. It records the accepted ESO VISTA, Horálek optical and NASA WISE placements and saturation, detail strength/scale, brightness and gamma. It references the existing source/alignment, baseline, catalogue and presentation recipes by hash. The historical result IDs in `app-lenses.json` are replaced with the newly produced IDs during replay; the recorded presentation settings remain unchanged. Re-running the full bake verifies and reuses completed stages, then refreshes its receipt. Re-running `pnpm lab:nebula:verify` checks the results without processing.

The accepted NOX images include an earlier compact-source baseline through a positive-residual union. This command **requires and reproduces that baseline**; omitting it would change the accepted pixels. The older interactive calibration UI is not restored. Reconstruction never runs star removal again.

The scalar grids and existing catalogue measurements are the pipeline's scientific inputs. This command does not rerun the N-body simulation or reacquire its multi-gigabyte snapshots. It reconstructs catalogue positions from the configured sky reference and density, independently of the chosen color image. The simulation prior remains an approximation to stellar density, not measured gas/dust depth.

## Options

Options with values use `--name=value`. Stages include their preceding dependencies and reuse verified completed results.

| Option | Purpose |
|---|---|
| `--stage=density` | Offline neutral fields only |
| `--stage=assets` | Neutral fields and inspection/reference images; used by lab startup/tests, without Python or star removal |
| `--stage=removal` | Stop after native baseline/NOX products and separation previews |
| `--stage=reconstruction` | Stop after individual cloud variants |
| `--stage=all` | Default; also assemble the local lens bank and restore configured app textures |
| `--if-missing` | Verify the complete app delivery; bake only if textures are absent. Cannot combine with an image filter or partial stage |
| `--image=wise-wide-infrared` | Process just one configured image; also accepts `vista-infrared` or `horalek-widefield` |
| `--recipe=<json>` | Select an explicitly configured source set |
| `--python=<executable>` | Use an existing environment; verify package versions without modifying it |

Only LMC has accepted color reconstructions. SMC currently supplies its neutral density field, not invented color lenses. New objects require their own approved source/registration/prior configuration and lab subject records before the same processors can be used.

For the separate production environment assets (outside this nebula-only workflow), `pnpm prepare:environment-images` restores the M31/M33/SMC layers, Milky Way slices and sky faces, heliosphere atlas and stellar point atlas from their pinned sources. It only bakes missing banks and verifies every restored byte against the accepted resource manifests. Pass `--verify-replay` to independently rebake even a complete bank. These operations preserve the descriptors and saved rendering settings. App startup/build and universe CI restore these images automatically.

`pnpm prepare:nebulae` runs the `--if-missing` check automatically before app development, builds and shell tests. The first run on a clean checkout needs the same Python environment/downloads as a full bake. Later starts only verify the accepted files. A changed file is an error, not permission to silently replace it.

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
