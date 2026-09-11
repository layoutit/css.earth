# Current workflow

## Start the local app

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula
```

Open [Alignment](http://127.0.0.1:4331/alignment). Startup recreates any missing LMC/SMC density slices from the tracked scalar grids; repeat starts verify and reuse them. Processing additionally needs the pinned native source, the local NOX environment/model for star removal, and the existing density prior. Missing inputs produce an actionable error; starting the viewer does not download or bake them. See [star-removal dependencies](star-removal.md#model-and-dependencies).

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

**For Helix, start at `/alignment?subject=helix-model-prior`.** The observation workspace shares one north-up angular frame across ESO WFI optical, the wider ESO field and VISTA infrared. It does not require a prepared volume. Compare a reference and overlay, or all observations, on the same scale; zoom into distributed stars rather than matching only the central ring. Native source pixel transforms remain fixed across Original / Without stars / Residual. Manual nudges are saved separately from the measured registration.

Advance in visible steps: **alignment → inspect star removal → approve structure extraction → inspect structures → compare depth hypotheses**. Selecting an image or a prepared layer starts no processing. The planetary observation command currently prepares inputs offline; LMC's existing removal and reconstruction job buttons retain their own workflow. No new Helix structure map or volume is inferred automatically. Infrared and optical emission are allowed to differ after their stars align.

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
| Explicit lens-settings handoff | **Save lens settings** in Reconstruction writes `.local/nebula-lab/lens-settings/latest.json` and an immutable timestamped receipt |
| Versioned recipes/evidence | `models/lmc/`, `models/smc/`, shared recipe files and `sources/` |

An image-to-density placement change requires **Preview** again to produce a matching bank. Browsing a result does not rewrite it. Promotion into a checked-in model or production object is a separate explicit task, with source credits and replay instructions retained.

For a handoff, click **Save lens settings** once in the browser where you adjusted the lenses; one click exports every image's stored settings, so repeating it for all sources is unnecessary. It captures stored settings for every image, current result identity, cloud selection/axis brightness, stars and the active density draft separately from the applied filter. Wait for **✓ Lens settings saved**. It does not process or promote anything. Unvisited images have no personal settings to export; never substitute another browser's test bakes for the user's choices.

## Development checks

For UI/backend changes, run the lab typecheck and only the affected colocated tests during iteration. At the final lab boundary, run its suite and affected browser flow. No unrelated production build is needed for a lab-only change.

Read [AGENTS.md](../AGENTS.md) for module ownership and development rules. Historical decomposition experiments are under [research](research/README.md); their former tabs and removed objects are not part of this workflow.

## Replay without browser state

Use the [bake command](baking.md) to rebuild the accepted three-source LMC bank. It owns acquisition, the saved baseline and NOX pass, fixed-density coloring, catalogue-star placement and saved display settings. It also restores ignored extraction previews and the configured app slice textures against their accepted hashes. Interactive jobs and the running server remain independent.
