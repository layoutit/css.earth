# Nebula Lab

A local inspection workspace for galaxy image layers and particle density volumes. It uses the actual CSS renderer and retained camera controls, separate from the application shell.

From the repository root. The extraction steps create local LMC/SMC comparison candidates; omit those steps if you only want to inspect the existing prepared banks.

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula:extract src/objects/lmc/source/source.jpg .local/nebula-lab lmc
pnpm lab:nebula:extract src/objects/smc/source/source.jpg .local/nebula-lab smc
pnpm lab:nebula
```

Open <http://127.0.0.1:4331/>. A dedicated Vite configuration serves only the lab entry, with filesystem access to the repository's prepared banks. The lab has no production route or publishing step. The local source images and prepared image banks must already be present; `pnpm lab:nebula` does not acquire or bake assets.

- Choose a prepared subject, then drag to orbit and scroll or pinch to zoom.
- Inspect the whole object, diffuse component, or compact detail.
- Use Auto for normal axis selection, or isolate X, Y, or Z. Diffuse and compact-detail inspection uses Z; choosing another axis restores Whole object because the side banks combine both components. A subject without a separate detail bank disables Compact detail.
- Depth selects all layers or one prepared layer. Selecting a layer in Auto freezes the currently dominant axis so the layer remains identifiable while orbiting.
- Source image shows the available local references. Where several exist, its Image chooser switches between the wide field and a detail reference; this changes only the comparison image, not the 3D model. Source and credit follows the inspected image and returns to the model's base source in 3D view.
- Reset camera restores the subject's initial view.

The subjects include M31, M33, LMC and SMC image layers, separate LMC and SMC particle volumes, and the Milky Way volume reference. The selector is populated from the viewer's subject catalogue; further prepared subjects can use the same controls. Modeled image depth is an interpretation of a two-dimensional image, not a measured reconstruction.

Each subject names a prepared object directory. Its comparison image can be relative to that directory (`image`) or to the repository (`imagePath`); the image is displayed only in the Source tab. Density models use the existing prepared-volume loader and renderer, with an explicit model description and no compact-detail control when no separate detail bank exists.

Extraction writes `{id}-{cutout,diffuse,residual,mask,comparison}.png` and `{id}-receipt.json` to the local output directory. The comparison panels show source, diffuse, compact residual, alpha mask, and final cutout. The Source image chooser discovers the cutout, diffuse, residual, and mask candidates. These offline experiments do not replace the prepared 3D banks or modify production assets.

`viewer.ts` owns the actual renderer and camera. `main.ts` only connects retained controls to its API. All images and geometry are prepared before inspection.

## Magellanic particle experiment

The particle subjects use the 2.2 Gyr snapshot from [Garver et al.'s simulation dataset](https://doi.org/10.5061/dryad.1vhhmgr82), described in [their paper](https://doi.org/10.1093/mnras/stag1287). The dataset is CC0. NOIRLab/SMASH photographs supply approximate fixed colors under CC BY 4.0; their original credits and links are preserved in each model and the source comparison.

- The importer selects 1,620,000 LMC and 225,000 SMC stellar particles from the Tipsy star family; dark matter does not become luminous material.
- Centering and rigid display rotation preserve physical distances. Mass deposition and smoothing create a real XYZ density grid, then the existing volume baker prepares 64 slabs on each axis.
- Colors are sampled into the volume once. The camera never reprojects the photograph. The authored alignment is not an astrometric fit, and brightness is not calibrated photometry.
- This collisionless simulation supplies stellar mass density, not gas, dust extinction, or emission-line structure. These are initial morphology experiments, not final optical reconstructions.
- Display bounds retain about 99.6% of each galaxy's stellar mass. Receipts record exact retained mass, units, transformation, source hashes and output hashes.

The prepared candidates are checked in. Rebuilding requires Python 3 and a manual download of `lsmcmodelA2020_2500Myr.zip` from the linked dataset. From a clean checkout, after placing the archive in Downloads:

```sh
pnpm install --frozen-lockfile
pnpm build:preparation
pnpm lab:nebula:particles labs/nebula/models/magellanic-particles.json "$HOME/Downloads/lsmcmodelA2020_2500Myr.zip"
pnpm test:lab:nebula
pnpm lab:nebula
```

The archive and imported particles stay in the ignored local cache. The shared experiment recipe pins the archive and decompressed snapshot; per-model source receipts, compressed density grid and prepared CSS banks live under `models/`. The full archive is never a browser dependency. Rendering the two candidate banks downloads about 1.2 MB combined, with about 60 MB decoded texture data.
