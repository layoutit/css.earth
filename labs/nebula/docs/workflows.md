# Current workflow

## Start the local app

From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm lab:nebula
```

Open [Alignment](http://127.0.0.1:4331/alignment). Startup restores neutral density and inspection/reference images, acquiring missing originals without running star removal or reconstruction. Repeat starts verify and reuse them. For the compiler's complete setup, including its Python environment, pinned NOX model and offline replay, use [Compile an emission nebula](emission-compiler.md#reproduce-from-a-clean-checkout).

Do not restart an already running server to switch views. Legacy `?subject=…&tab=alignment|reconstruction` links normalize to the corresponding path. Object selection remains in the URL; camera and per-image adjustments are retained locally.

## 1. Align an image

1. Choose **LMC** or **SMC** in the header, then **Alignment**.
2. Use **Reference view** to return to the approximate solar observer. **Fit cloud** changes inspection framing; drag or scroll to explore the actual density volume.
3. Choose the reference image on the right. Its publisher/star-registered projection is the starting point. Keep the entire image footprint and full density field visible while comparing them.
4. Adjust position, rotation, size and opacity. Density and image brightness/gamma/levels are independent inspection controls. **Copy positioning** exports the fit; the browser also saves it per image.
5. Verify direction, angular scale, matched-star coverage and missing edges before processing a new source. An authored fit to simulated density is not astrometric evidence. [Registration](registration.md) · [Candidate evidence](image-candidates.md).

The full neutral fields contain all imported LMC/SMC stellar particles. They are simulated stellar mass, not observed gas or dust. A photograph's boundary is its coverage limit, not the density cloud's boundary.

## Image-driven methods

The object configuration selects the available depth evidence; it never selects a private app or source-specific algorithm.

| Method | Depth evidence | Initial example |
| --- | --- | --- |
| Density model | Independently supplied simulation or reconstruction; images only paint it | LMC / SMC |
| Symmetry | Explicit axis, inclination and symmetry assumptions | M2–9 |
| Constrained inference | Registered observations, then competing shape assumptions and external constraints | Helix |

**For Helix, open `/reconstruction?subject=helix-model-prior&inspection=compiler`.** The default **Nebula** view keeps the final cloud in the workspace. Press **Compile nebula** once; this authorizes source restoration, registration/star separation, structure preparation, the optional velocity scaffold, emission fitting and baking. Missing prepared files do not disable Compile. The configured current sources are already authorized; there are no intermediate acceptance clicks.

After the first successful compile, **Detail**, **Faint emission** and **Depth** update automatically. Only the latest pending settings follow the active job; the previous cloud remains visible until the replacement decodes. Progress, **Cancel** and **Retry compile** are explicit. Refresh reconnects to the server-owned job and restores saved settings and camera. Cancellation does not restart work on refresh. Lens, **Neutral/Textured**, **Stars**, **Original**, **Earth view** and **Orbit** change prepared display state without baking.

**Alignment** remains available at `/alignment?subject=helix-model-prior`. Its north-up angular frame registers ESO WFI optical, the wider ESO field and VISTA infrared. One image is visible at a time; switching preserves the camera and sky scale. Original / Without stars / Residual use the same native-pixel transform, and manual nudges remain separate from measured registration. Infrared and optical emission may differ after their stars align. Browsing a source or layer starts no processing.

**Structure map** is a diagnostic for prepared morphology/scale/area/contrast/elongation and **Keep / Unsure / Reject** reviews. Supported arcs and dashed extrapolations are image-space hypotheses, not recovered physical objects. Reviews persist per source/extraction; filters start no processing. **Volume** loads the older failed Hubble baseline. See [structure inspection](nebula-compiler.md) and the [compiler's method and limits](emission-compiler.md).

**Combined** inspects the three registered sources together. **Joint fit** automatically fits a coarse molecular shell/lobe pair to connected image ridges and published HCO+ velocities, then compares the prepared neutral volumes with withheld measurements. Sliders refit; source/candidate/camera switches only inspect. The separate **Velocity** view retains the inner [O III] slit. See [the joint-fit workflow and limits](joint-fit.md) before interpreting these conditional models as depth.

Scale, area, contrast and elongation use sliders with visible values. Area and elongation use logarithmic travel, and contrast gives finer control near zero. The values remain the actual filter thresholds; the slider spacing changes only how they are adjusted.

## 2. Remove stars

1. Optionally run **Quick preview** for native crops.
2. Press **Remove stars** for the selected original. This runs automatic NOX inference with actual progress and **Cancel**; no manual samples or calibration step is required.
3. Compare **Original / Without stars / Residual** and inspect bright cores, halos and compact nebular details. The strength slider blends the completed removal; it does not rerun detection.
4. Keep the native diffuse/residual/mask products. Reconstruction uses the complete native diffuse image at full removal, not a small display preview or the preview-strength blend.

Refresh reconnects to a running job. A completed result restores without inference. A server restart can interrupt unfinished processing; completed images remain stored. [Full details](star-removal.md).

## 3. Reconstruct and compare

1. Open [Reconstruction](http://127.0.0.1:4331/reconstruction) and choose a source. VISTA, Horálek and WISE are the approved LMC comparison candidates.
2. A completed variant loads directly. Adjust the five visible cloud material sliders and press **Preview** for a new appearance, placement or removal result. Draft settings persist per image; previewing reuses starless pixels. Merely selecting an image does not bake it.
3. Follow progress, or **Cancel**. The previous cloud remains visible until the new bank is fully prepared and decoded.
4. Compare saved variants at the same camera and brightness. Inspect front, oblique and edge views for sheet-like depth, repeated details, seams, disappearing layers and whitening.
5. Use **Earth view** to restore the painter’s observer and **Original image** plus opacity to compare image features with the cloud and catalogue.
6. Use brightness/axis calibration and integrated-signal cutoff to inspect the cloud. These controls do not establish physical depth or justify clipping unobserved data.

Current processing repaints the Alignment density cloud’s exact 144 prepared quads and preserves every alpha byte. A 1024px registered plane supplies candidate chromaticity; uncovered areas retain explicitly recorded neutral density color. The star toggle renders the same 943 catalogue stars placed through one fixed sky-to-density reference, independently of candidate image. Both tabs use the same density object and Earth framing. This is a material comparison on modeled geometry, not measured gas depth. See [the exact method and limits](reconstruction.md).

## Saved data

| Data | Location / lifetime |
|---|---|
| Camera, selected source, placement, inspection controls | Browser local storage; do not clear during development |
| Native originals | Ignored local cache, source-hash pinned |
| Native NOX outputs | `.local/nebula-lab/star-removal-nox-applied/`; diffuse, residual, mask and receipts |
| Running/saved job records | Separate star-removal and reconstruction job directories in the local cache |
| Completed reconstruction banks | `.local/nebula-lab/reconstructions/`; descriptors, XYZ textures, provenance and manifest |
| Compiler jobs and results | `.local/nebula-lab/compiler-jobs/` and `.local/nebula-lab/compiler/<result-id>/`; field, method, comparison images and shared lens banks |
| Explicit lens-settings handoff | **Save lens settings** in Reconstruction writes `.local/nebula-lab/lens-settings/latest.json` and an immutable timestamped receipt |
| Versioned recipes/evidence | `models/lmc/`, `models/smc/`, shared recipe files and `sources/` |

An image-to-density placement change requires **Preview** again to produce a matching bank. Browsing a result does not rewrite it. Promotion into a checked-in model or production object is a separate explicit task, with source credits and replay instructions retained.

For a handoff, click **Save lens settings** once in the browser where you adjusted the lenses; one click exports every image's stored settings, so repeating it for all sources is unnecessary. It captures stored settings for every image, current result identity, cloud selection/axis brightness, stars and the active density draft separately from the applied filter. Wait for **✓ Lens settings saved**. It does not process or promote anything. Unvisited images have no personal settings to export; never substitute another browser's test bakes for the user's choices.

## Development checks

For UI/backend changes, run the lab typecheck and only the affected colocated tests during iteration. At the final lab boundary, run its suite and affected browser flow. No unrelated production build is needed for a lab-only change.

Read [AGENTS.md](../AGENTS.md) for module ownership and development rules. Historical decomposition experiments are under [research](research/README.md); their former tabs and removed objects are not part of this workflow.

## Replay without browser state

Use the [bake command](baking.md) to rebuild the accepted three-source LMC bank. It owns acquisition, the saved baseline and NOX pass, fixed-density coloring, catalogue-star placement and saved display settings. It also restores ignored extraction previews and the configured app slice textures against their accepted hashes. Interactive jobs and the running server remain independent.

Use the [emission compiler command](emission-compiler.md#reproduce-from-a-clean-checkout) for configured inference subjects. It restores its source stages and compiles recipe defaults without browser state. This remains a local experimental cloud; it does not promote a production asset.
