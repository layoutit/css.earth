# Compile an emission nebula

The compiler prepares one conditional 3D emission cloud from registered images, with an optional measured-velocity scaffold or evidence-addressed surface recipe. **Reconstruction → Nebula** shows that final cloud. [Helix](../models/helix/README.md) uses a velocity scaffold; Orion and Carina now test a paper-guided, authored irregular front. The other [irregular candidates](../models/inference-candidates/README.md) retain image-only priors. Visual and physical acceptance remain separate from successful processing.

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

**Stages** shows the completed/reused receipt directly; **Sources & method** contains the longer interpretation. Alignment, source comparison, structure maps, combined evidence, joint surfaces and the separate core slit remain diagnostics in the shared workbench. They are not prerequisites requiring manual shape authoring.

## What is fitted

1. **Preserve the observations.** Existing preparation owners acquire hash-pinned originals, verify registration and restore native NOX separation. Original, diffuse and compact-residual layers retain their shared native-pixel transform. Complete matching removal results are reused. Compact nebular knots can be removed and stellar cores/halos can remain; the residual is not a membership catalogue.
2. **Combine relative luminosity.** Registered starless sources retain independent coverage and per-source normalization. The current target combines 70% of the strongest weighted normalized luminance with 30% of the weighted mean. Background/white estimates and the tone transform are recorded in the method receipt. This is a relative display-luminosity target from stretched images, not calibrated luminosity, a same-band flux sum or gas density. Missing coverage remains distinct from measured zero.
3. **Use velocities where available.** An optional recipe fits coarse molecular-wall alternatives to image ridges and measured velocities, then supplies the best fitted surface as a depth scaffold. The Helix [HCO+ catalogue and joint method](joint-fit.md) retain their LSR frame, beam approximation and withheld pointings. The inner [O III] slit remains an independent diagnostic. Velocity coverage does not assign unique depths to individual image features.
4. **Fit positive multiscale emission.** Smooth finite supports at several spatial scales reduce the projected target residual with nonnegative coefficients. At default depth, supported features divide their light equally among scaffold ray intersections. Features lacking an intersection use a diffuse prior centered at z = 0. Its finite depth extent is tied to the scaffold size, or to the emission's central second moment when no scaffold exists. This is an authored uncertain halo, not measured near/far surfaces. Scaffold allocation and every component thickness remain conditional. Detail cannot add information absent from the source; faint controls can admit background and removal artifacts.
5. **Bake one field and its lenses.** Offline XYZ banks sample the complete finite 3D support. A neutral bank and each registered RGB-only lens share geometry and every decoded alpha byte; image color never reallocates emission along rays. The runtime only verifies/decodes/transports prepared banks through the retained PolyCSS viewer.
6. **Keep compact lights conditional.** Points detected in the configured reference image's stellar residual retain observed sky positions and relative display brightness. Measure the background-subtracted aperture light before selecting the bounded catalogue, then keep the brightest candidates with positive fitted-emission columns. Weak positive columns remain eligible. Stable detection identities preserve conditional depth and photometry when the budget changes. These are illustrative compact lights, not independently measured stellar distances or confirmed nebular members. All lenses share them.

Image-fit error, missing/excess signal and velocity residuals answer different questions. The fit's baseline RMSE is the zero-emission model on the same covered target pixels. Missing/excess fractions refer to normalized display signal; they are not mass fractions. A better projection cannot validate depth, and the display is not a hydrodynamic simulation. Inspect neutral front, oblique and side views as well as textured source comparisons before accepting any visual result.

## Automatic layer budget

New compiler and sampled-volume deliveries reserve **at most 500 total retained scene elements**, including hidden elements, stars, optical copies, impostors and wrappers. The current single-topology CSS profile reserves 47 elements for delivery overhead and three elements per XYZ slab, plus one per separate star. With no stars, the optimizer receives a maximum of 151 total XYZ slabs. Every retained star reduces that allowance; an impossible allocation fails before baking rather than silently dropping stars. Final app admission also verifies topology and actual delivery overhead.

Prefer source-backed slab emission for unresolved or dense light and fewer separate catalogue stars when the evidence supports it. Do not count the same light twice or infer measured stellar depths from an image. The field and its supported feature scale still determine the fine reference grid. An offline probe groups adjacent reference cells into wider intervals where less depth detail is needed. Each interval integrates every original reference midpoint, including faint emission, before encoding one RGBA8 texture. Material painting uses those same physical intervals and depth samples. This reduces retained planes and texture files; it does not promise proportionally less sampling work.

The planner probes at 64 pixels wide with four image subpixel phases. Spatial variation and displacement from the reference planes estimate the extra error caused by grouping. Dynamic programming chooses complete partitions instead of making greedy splits, which can strand a concentrated feature inside a wide interval. It selects the fewest layers meeting a 1% planning estimate on each axis; if the budget prevents that, it minimizes the worst axis and records `budget-limited`. Sampled component mixtures plan once from an envelope covering every prepared lens, then share that partition.

The saved sampling receipt contains the exact reference grid, intervals, planning report and versioned renderer-cost reservation. All image-only lenses share one topology; component mixtures must not multiply resident topologies beyond the final element allowance. `target-met` describes only this coarse estimate: subpixel features, material differences, RGBA8 rounding and browser compositing still require actual output checks. Inspect front, oblique and side views and compare both banks at each axis handoff. Keep the 5% relative-luminance and 4% normalized-L1 handoff gates unchanged. A failed result remains unaccepted; a completed bake or a small element count cannot qualify it.

Verified compact replay uses its saved partition exactly and never replans. Historical receipts without a renderer-cost reservation retain their original sampling and bytes, including over-budget deliveries; replay reports that limitation. A new cost receipt must still pass validation during replay. New authoring cannot opt out by supplying an old sampling record. Existing repaint-only workflows keep their explicit sampling until separately requalified. The shared planner and grouped baker are available to those preparation owners without runtime sampling or geometry generation.

## Reproduce from a clean checkout

Requires the checkout containing the compiler, **Node 22.18+ or a supported newer release, pnpm 10.33.0, Python 3.9–3.12 with venv/pip**, internet access and disk space for native images and results. `python3` below must select that supported Python. The pinned TensorFlow release needs a wheel for the machine's OS/CPU. Run this complete sequence from the repository root; keep an existing lab server alive and omit only the final server command when it already runs.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/run.mts compile-nebula labs/nebula/models/helix/compiler.json
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

`--ignore-scripts` avoids repository-wide asset preparation. The [NOX dependency record](star-removal.md#model-and-dependencies) supplies the model version and SHA-256 checked by native processing. The compiler restores its observation, structure and optional molecular inputs; separate structure, geometry, joint-fit or historical-volume commands are unnecessary for this path. It verifies and reuses matching completed products. The CLI uses recipe/default controls, registration and source weights; browser diagnostic edits are included only in browser requests.

Completion prints a JSON record with `status: "complete"`, result ID, metrics and stage timings. The corresponding `.local/nebula-lab/compiler/<result-id>/result.json` links the fitted field, method receipt, target/projection/residual panels, source panels and shared scene. The receipt binds recipe, implementation, source layers, registration/evidence identity, measured velocities and controls. Replay validates referenced hashes before reusing the result. Original data, native products and completed jobs remain local; compilation does not publish or promote them.

## Configuration and assessment

The generic compiler recipe references observation and structure recipes/catalogues, an optional `jointRecipe` or `depthRecipe`, a default image lens and a compact-light budget. Source-specific facts stay in those records. Omitting both depth recipes produces an explicitly assumed image-only prior; it does not make depth measured.

An optional `emissionWindow: { "sourceId": "…", "featherArcsec": 90 }` limits an inferred cloud to one selected image's registered footprint. The compiler preserves complete native images, source normalization and no-data coverage, then applies an inward feather to the combined target and fitted XYZ field. Its analytic projection, saved-field decoder and all material banks use that same selection. This is an authored display extent, not an astrophysical edge or a change to an independent measured volume; sampled-volume recipes reject it. Omitting the property preserves the existing field exactly. [Lagoon's optical selection](../models/m8/README.md#previous-optical-extent--2026-09-13) records the refit and outside-emission check.

An optional `observedStars` source pin replaces residual detections with an external ICRS epoch-2000 catalogue. Rank by Johnson V within the shared spatial frame, retain catalogue directions, derive display colors from B−V, and keep the same optical reference lights across all spectral lenses. Missing dust support does not discard a real catalogue star; unsupported depth is explicitly authored at the reference plane. Measured membership and distance are not inferred. The Pleiades recipe and its stellar source receipt demonstrate this route.

New compiler stars use a prepared atlas of the main application's soft core/halo profile. Offline decoded-alpha integration compensates sprite extent to conserve relative display light; runtime only positions and selects prepared tiles. The optional `refresh-compiler-stars` command requires a valid existing result and permits only stellar recipe changes. It retains cloud banks and their original identity, writes a new result, and verifies the retained resources before updating the local publication. Full compilation prepares the configured catalogue and profile through the same owners. Source acquisition is separate; `acquire-stellar-field` replays the catalogue's saved source receipt.

Saved publications verify current scientific inputs and immutable output hashes. Recorded producer-code hashes remain historical provenance when the working compiler changes; inspecting an old cloud does not requalify it against newer material gates. Never rewrite those historical hashes merely to make a cached cloud load.

`depthRecipe` selects one coherent irregular height surface. It pins a physical evidence ledger, labels unmeasured coefficients as authored, and scopes local published guidance without extrapolating it across the photograph. Finite supports follow local depth and tilt; their analytic observer projection remains unchanged by that conditioning. Smaller XY supports and a larger usable basis budget improve image detail separately. Thin supports use finer bounded slab spacing and emission-weighted material sub-sampling, with unchanged alpha across all lenses. The surface and joint velocity methods cannot be combined silently. See the [process guidelines](nebula-compiler-guidelines.md), [Orion comparison](../models/m42/README.md) and [Carina comparison](../models/carina/README.md) for active operations, exact results and remaining limits.

The [Helix README](../models/helix/README.md) owns source selection, registration evidence, version-specific results and historical failures. Use it with the [research limits](multimodal-research.md). Successful processing, runtime interaction, scientific fidelity and visual acceptance are separate claims. Current work has not accepted the compiler as a recovered physical Helix model.
