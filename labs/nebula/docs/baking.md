# Rebuild the accepted nebulae

From a clean checkout with Node 22, pnpm and Python 3.9–3.12 installed:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula:bake
pnpm lab:nebula
```

The bake downloads missing native originals and the pinned NOX model, creates a local Python environment with pinned dependencies, and verifies hashes before processing. Large downloads and intermediate files stay in `.local/`. Allow several gigabytes of free space. The first full run takes minutes; later runs verify and reuse completed native removal/reconstruction results. Python package installation requires an available wheel for the machine's platform.

The command does not need the browser's localStorage, a running server or previously completed image jobs. It does not restart the lab, change browser settings, install a production object or publish anything.

## Stages and configuration

| Stage | Source of truth | Result |
|---|---|---|
| Density | LMC/SMC scalar grids, physical frames and volume recipes | The same 144 neutral slices per object; geometry and pixel hashes verified |
| Images | Three native originals, source hashes and accepted registration metadata | Full-footprint inspection previews; sky registration is preserved |
| Removal | Saved baseline recipes, pinned NOX script/model and Python versions | Native starless image, residual and mask with exact subtraction checks |
| Reconstruction | Shared density, catalogue/sky reference, saved placement and RGB controls | XYZ cloud banks plus the same 943 modeled catalogue stars for every image |
| Lens bank | Saved cutoff, axis brightness, enabled cloud contributions, star exposure/size | A local three-lens object ready for a separate production handoff |

`models/lmc/bake.json` is the entry recipe. It records the accepted ESO VISTA, Horálek optical and NASA WISE placements and saturation, detail strength/scale, brightness and gamma. It references the existing source/alignment, baseline, catalogue and presentation recipes by hash. The historical result IDs in `app-lenses.json` are replaced with the newly produced IDs during replay; the recorded presentation settings remain unchanged.

The accepted NOX images include an earlier compact-source baseline through a positive-residual union. This command **requires and reproduces that baseline**; omitting it would change the accepted pixels. The older interactive calibration UI is not restored. Reconstruction never runs star removal again.

The scalar grids and existing catalogue measurements are the pipeline's scientific inputs. This command does not rerun the N-body simulation or reacquire its multi-gigabyte snapshots. It reconstructs catalogue positions from the configured sky reference and density, independently of the chosen color image. The simulation prior remains an approximation to stellar density, not measured gas/dust depth.

## Options

All options are `--name=value`. Stages include their preceding dependencies and reuse verified completed results.

| Option | Purpose |
|---|---|
| `--stage=density` | Offline neutral fields only; used automatically by lab startup and lab tests |
| `--stage=assets` | Neutral fields and original image previews; no Python or star removal |
| `--stage=removal` | Stop after native baseline/NOX products and separation previews |
| `--stage=reconstruction` | Stop after individual cloud variants |
| `--stage=all` | Default; also assemble the local lens bank |
| `--image=wise-wide-infrared` | Process just one configured image; also accepts `vista-infrared` or `horalek-widefield` |
| `--recipe=<json>` | Select an explicitly configured source set |
| `--python=<executable>` | Use an existing environment; verify package versions without modifying it |

Only LMC has accepted color reconstructions. SMC currently supplies its neutral density field, not invented color lenses. New objects require their own approved source/registration/prior configuration and lab subject records before the same processors can be used.

## Files and recovery

```text
models/
  lmc/bake.json                    tracked stage recipe and accepted settings
  {lmc,smc}/full-density/source/   tracked compact density grids and provenance
  {lmc,smc}/full-density/prepared/
    *.json                        tracked reference geometry and resource hashes
    slices/                       ignored, regenerated textures
  lmc/candidates/                 tracked registration and three inspection previews
  lmc/stars/                      tracked catalogue input and sky-to-model reference
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

Small reference metadata and the three original/separation inspection previews remain versioned for the alignment tool. Runtime density textures and newly reconstructed banks are generated, not committed. The command can also recreate those previews from the originals.

`BAKE_COMPLETE` is printed only after validating the output. The receipt identifies the recipe hash, source/result IDs and final output directory. Full lens-bank manifests pin every delivered file. A failed stage exits nonzero and leaves the previous completed results intact. Source mismatches are errors, never silent replacements.

One command can own a recipe at a time. An ordinary failure or Ctrl-C releases its lock. After a hard machine/process crash, inspect `.local/nebula-lab/bakes/lmc.lock/owner.json` and remove that lock only after confirming its PID is no longer running. Re-run the same command; verified completed removal/reconstruction stages are reused. An incomplete or altered saved result is reported rather than treated as a successful cache hit.

Current rendering limitations, including oblique brightness changes and the simulation/observation offset, remain documented in [slice stability](slice-stability.md) and [next steps](../NEXTSTEPS.md). Successful replay establishes reproducibility, not new scientific or visual accuracy.
