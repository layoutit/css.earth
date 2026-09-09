# Current workflow

## Start the local app

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula
```

Open [Alignment](http://127.0.0.1:4331/alignment). Existing prepared LMC/SMC assets can be inspected immediately. Processing additionally needs the pinned native source, the local NOX environment/model for star removal, and the existing density prior. Missing inputs produce an actionable error; starting the viewer does not download or bake them. See [star-removal dependencies](star-removal.md#model-and-dependencies).

Do not restart an already running server to switch views. Legacy `?subject=…&tab=alignment|reconstruction` links normalize to the corresponding path. Object selection remains in the URL; camera and per-image adjustments are retained locally.

## 1. Align an image

1. Choose **LMC** or **SMC** in the header, then **Alignment**.
2. Use **Reference view** to return to the approximate solar observer. **Fit cloud** changes inspection framing; drag or scroll to explore the actual density volume.
3. Choose the reference image on the right. Its publisher/star-registered projection is the starting point. Keep the entire image footprint and full density field visible while comparing them.
4. Adjust position, rotation, size and opacity. Density and image brightness/gamma/levels are independent inspection controls. **Copy positioning** exports the fit; the browser also saves it per image.
5. Verify direction, angular scale, matched-star coverage and missing edges before processing a new source. An authored fit to simulated density is not astrometric evidence. [Registration](registration.md) · [Candidate evidence](image-candidates.md).

The full neutral fields contain all imported LMC/SMC stellar particles. They are simulated stellar mass, not observed gas or dust. A photograph's boundary is its coverage limit, not the density cloud's boundary.

## 2. Remove stars

1. Optionally run **Quick preview** for native crops.
2. Press **Remove stars** for the selected original. This runs automatic NOX inference with actual progress and **Cancel**; no manual samples or calibration step is required.
3. Compare **Original / Without stars / Residual** and inspect bright cores, halos and compact nebular details. The strength slider blends the completed removal; it does not rerun detection.
4. Keep the native diffuse/residual/mask products. Reconstruction uses the complete native diffuse image at full removal, not a small display preview or the preview-strength blend.

Refresh reconnects to a running job. A completed result restores without inference. A server restart can interrupt unfinished processing; completed images remain stored. [Full details](star-removal.md).

## 3. Reconstruct and compare

1. Open [Reconstruction](http://127.0.0.1:4331/reconstruction) and choose a source. VISTA, Horálek and WISE are the approved LMC comparison candidates.
2. A completed variant loads directly. For a new placement/removal result, press **Process** explicitly. Merely selecting an image does not bake it.
3. Follow progress, or **Cancel**. The previous cloud remains visible until the new bank is fully prepared and decoded.
4. Compare saved variants at the same camera and brightness. Inspect front, oblique and edge views for sheet-like depth, repeated details, seams, disappearing layers and whitening.
5. Use brightness/axis calibration and integrated-signal cutoff to inspect the cloud. These controls do not establish physical depth or justify clipping unobserved data.

Current processing colors only occupied density with the native starless image and bakes a 512px comparison model with shared XYZ geometry. The star toggle renders the same catalogue independently of the image. It is an approximate reconstruction baseline, not native-resolution geometry or a final production model. See [the exact method and limits](reconstruction.md).

## Saved data

| Data | Location / lifetime |
|---|---|
| Camera, selected source, placement, inspection controls | Browser local storage; do not clear during development |
| Native originals | Ignored local cache, source-hash pinned |
| Native NOX outputs | `.local/nebula-lab/star-removal-nox-applied/`; diffuse, residual, mask and receipts |
| Running/saved job records | Separate star-removal and reconstruction job directories in the local cache |
| Completed reconstruction banks | `.local/nebula-lab/reconstructions/`; descriptors, XYZ textures, provenance and manifest |
| Versioned recipes/evidence | `models/lmc/`, `models/smc/`, shared recipe files and `sources/` |

An image-to-density placement change requires **Process** again to produce a matching bank. Browsing a result does not rewrite it. Promotion into a checked-in model or production object is a separate explicit task, with source credits and replay instructions retained.

## Development checks

For UI/backend changes, run the lab typecheck and only the affected colocated tests during iteration. At the final lab boundary, run its suite and affected browser flow. No unrelated production build is needed for a lab-only change.

Read [AGENTS.md](../AGENTS.md) for module ownership and development rules. Historical decomposition experiments are under [research](research/README.md); their former tabs and removed objects are not part of this workflow.
