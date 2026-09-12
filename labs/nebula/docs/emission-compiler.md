# Compile an emission nebula

The compiler prepares one conditional 3D emission cloud from registered images, with an optional measured-velocity scaffold. **Reconstruction → Nebula** shows that final cloud. The first configured example is [Helix](../models/helix/README.md); its visual acceptance remains open. A second nebula is deferred until this machinery is assessed.

## Use the main view

Open [Helix → Nebula](http://127.0.0.1:4331/reconstruction?subject=helix-model-prior&inspection=compiler) and press **Compile nebula**. The job restores required observations and prepared evidence, then fits and bakes the cloud. Missing caches do not disable the action. Source stages keep their validation and provenance; no intermediate acceptance clicks are required for the authorized configured sources.

| Control | Effect |
| --- | --- |
| Detail · default 65% | Changes the bounded fit resolution, component budget and smallest emission scale |
| Faint emission · default 35% | Changes which weak residual peaks can receive emission components |
| Depth · default 1.00× | Stretches inferred depth and thickness while preserving integrated projected light; it does not refit the velocity law |
| Lens; Neutral / Textured | Selects prepared RGB material on the same geometry and alpha |
| Stars; Original | Toggles prepared compact lights or the registered original-image overlay |
| Earth view; Orbit | Restores the observer view or enables rotation; drag/scroll controls the retained camera |

After the first successful compile, fit controls apply automatically; only the newest pending settings follow an active job. The old cloud remains until its replacement decodes. **Cancel** stops work; **Retry compile** reconnects or retries after failure. Settings, job pointers and camera persist per recipe/catalogue. Refresh detaches and reconnects an observer without cancelling server work; a server restart can mark unfinished work interrupted. A cancelled job does not restart merely on refresh. Display and camera changes do not bake.

**Compilation details** gives the completed/reused stage receipt. Alignment, source comparison, structure maps, combined evidence, joint surfaces and the separate core slit remain diagnostics in the shared workbench. They are not prerequisites requiring manual shape authoring.

## What is fitted

1. **Preserve the observations.** Existing preparation owners acquire hash-pinned originals, verify registration and restore native NOX separation. Original, diffuse and compact-residual layers retain their shared native-pixel transform. Complete matching removal results are reused. Compact nebular knots can be removed and stellar cores/halos can remain; the residual is not a membership catalogue.
2. **Combine relative luminosity.** Registered starless sources retain independent coverage and per-source normalization. The current target combines 70% of the strongest weighted normalized luminance with 30% of the weighted mean. Background/white estimates and the tone transform are recorded in the method receipt. This is a relative display-luminosity target from stretched images, not calibrated luminosity, a same-band flux sum or gas density. Missing coverage remains distinct from measured zero.
3. **Use velocities where available.** An optional recipe fits coarse molecular-wall alternatives to image ridges and measured velocities, then supplies the best fitted surface as a depth scaffold. The Helix [HCO+ catalogue and joint method](joint-fit.md) retain their LSR frame, beam approximation and withheld pointings. The inner [O III] slit remains an independent diagnostic. Velocity coverage does not assign unique depths to individual image features.
4. **Fit positive multiscale emission.** Smooth finite supports at several spatial scales reduce the projected target residual with nonnegative coefficients. At default depth, supported features divide their light equally among scaffold ray intersections. Features lacking an intersection use a diffuse prior centered at z = 0. Its finite depth extent is tied to the scaffold size, or to the emission's central second moment when no scaffold exists. This is an authored uncertain halo, not measured near/far surfaces. Scaffold allocation and every component thickness remain conditional. Detail cannot add information absent from the source; faint controls can admit background and removal artifacts.
5. **Bake one field and its lenses.** Offline XYZ banks sample the complete finite 3D support. A neutral bank and each registered RGB-only lens share geometry and every decoded alpha byte; image color never reallocates emission along rays. The runtime only verifies/decodes/transports prepared banks through the retained PolyCSS viewer.
6. **Keep compact lights conditional.** Points detected in the configured reference image's stellar residual retain observed sky positions and relative display brightness. Only columns with fitted emission are included; deterministic depth samples follow that inferred field. These are illustrative compact lights, not independently measured stellar distances or confirmed nebular members. All lenses share them.

Image-fit error, missing/excess signal and velocity residuals answer different questions. The fit's baseline RMSE is the zero-emission model on the same covered target pixels. Missing/excess fractions refer to normalized display signal; they are not mass fractions. A better projection cannot validate depth, and the display is not a hydrodynamic simulation. Inspect neutral front, oblique and side views as well as textured source comparisons before accepting any visual result.

## Reproduce from a clean checkout

Requires the checkout containing the compiler, **Node 22.18+ or a supported newer release, pnpm 10.33.0, Python 3.9–3.12 with venv/pip**, internet access and disk space for native images and results. `python3` below must select that supported Python. The pinned TensorFlow release needs a wheel for the machine's OS/CPU. Run this complete sequence from the repository root; keep an existing lab server alive and omit only the final server command when it already runs.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts compile-nebula labs/nebula/models/helix/compiler.json
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

`--ignore-scripts` avoids repository-wide asset preparation. The [NOX dependency record](star-removal.md#model-and-dependencies) supplies the model version and SHA-256 checked by native processing. The compiler restores its observation, structure and optional molecular inputs; separate structure, geometry, joint-fit or historical-volume commands are unnecessary for this path. It verifies and reuses matching completed products. The CLI uses recipe/default controls, registration and source weights; browser diagnostic edits are included only in browser requests.

Completion prints a JSON record with `status: "complete"`, result ID, metrics and stage timings. The corresponding `.local/nebula-lab/compiler/<result-id>/result.json` links the fitted field, method receipt, target/projection/residual panels, source panels and shared scene. The receipt binds recipe, implementation, source layers, registration/evidence identity, measured velocities and controls. Replay validates referenced hashes before reusing the result. Original data, native products and completed jobs remain local; compilation does not publish or promote them.

## Configuration and assessment

The generic compiler recipe references observation and structure recipes/catalogues, an optional joint-fit recipe, a default image lens and a compact-light budget. Source-specific facts stay in those records. Omitting the joint recipe produces an explicitly assumed image-only depth prior; it does not make depth measured.

The [Helix README](../models/helix/README.md) owns source selection, registration evidence, version-specific results and historical failures. Use it with the [research limits](multimodal-research.md). Successful processing, runtime interaction, scientific fidelity and visual acceptance are separate claims. Current work has not accepted the compiler as a recovered physical Helix model.
