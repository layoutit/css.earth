# Nebula Lab workflows

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

`src/viewer.ts` owns the actual renderer and camera. `src/main.ts` only connects retained controls to its API. All images and geometry are prepared before inspection.

## Magellanic particle experiment

The particle subjects use the 2.2 Gyr snapshot from [Garver et al.'s simulation dataset](https://doi.org/10.5061/dryad.1vhhmgr82), described in [their paper](https://doi.org/10.1093/mnras/stag1287). The dataset is CC0. NOIRLab/SMASH photographs supply approximate fixed colors under CC BY 4.0; their original credits and links are preserved in each model and the source comparison.

- The importer selects 1,620,000 LMC and 225,000 SMC stellar particles from the Tipsy star family; dark matter does not become luminous material.
- Centering and rigid display rotation preserve physical distances. Mass deposition and smoothing create a real XYZ density grid, then the existing volume baker prepares 64 slabs on each axis.
- Colors are sampled into the volume once. The camera never reprojects the photograph. The authored alignment is not an astrometric fit, and brightness is not calibrated photometry.
- The LMC experiment constrains projected brightness as well as color. It distributes photo emission along the simulated conditional depth profile, with an authored narrower depth for positive local detail. A shared-opacity bake preserves constant column hue through ordinary CSS alpha composition. No foreground-star depth or gas tomography is inferred.
- This collisionless simulation supplies stellar mass density, not gas, dust extinction, or emission-line structure. These are initial morphology experiments, not final optical reconstructions.
- LMC's higher-resolution grid covers the photographed core and retains 78.64% of the simulation's stellar mass; the full imported particles are preserved. The SMC density experiment retains 99.55%. Receipts record exact retained mass, units, transformation, source hashes and output hashes.
- The LMC Source image chooser includes a physical-scale photo / stellar mass / contour comparison. It exposes mismatches; the independently measured centroids and display contours are not a fit score. The photo footprint follows published sky coordinates and distance; its central-bar placement remains authored.

The prepared candidates are checked in. Rebuilding requires Python 3 and a manual download of `lsmcmodelA2020_2500Myr.zip` from the linked dataset. From a clean checkout, after placing the archive in Downloads:

```sh
pnpm install --frozen-lockfile
pnpm build:preparation
pnpm lab:nebula:images
pnpm lab:nebula:particles labs/nebula/models/magellanic-particles.json "$HOME/Downloads/lsmcmodelA2020_2500Myr.zip"
pnpm test:lab:nebula
pnpm lab:nebula
```

The archive and imported particles stay in the ignored local cache. The shared experiment recipe pins the archive and decompressed snapshot; per-model source receipts, compressed density grid and prepared CSS banks live under `models/`. The full archive is never a browser dependency. Pass an optional final target id such as `lmc-particles` to rebuild just that experiment.

## Full-resolution photographs

The lab includes full-spatial-resolution working references from the publisher's SMASH TIFFs: LMC 6737×6536 and SMC 3827×3190. `sources/reference-images.json` pins the original URLs, bytes, hashes, dimensions, credits and deterministic conversion. `pnpm lab:nebula:images` verifies or downloads the originals into the ignored cache, then recreates the checked-in 8-bit sRGB WebP references. These are lossy display derivatives with no crop or spatial resize, not scientific FITS data. Large reference images load only for source inspection and are not part of the prepared CSS texture banks.

ESO/VISTA offers larger infrared mosaics ([LMC](https://www.eso.org/public/images/eso1914a/), [SMC](https://www.eso.org/public/images/eso1714a/)), but their Y/J/Ks emission and colors differ from the optical/near-infrared SMASH composite. They are alternative observational views, not replacements silently mixed into the current optical appearance. The ESO Tarantula reference also uses a different display grade and enhanced H-alpha; its WCS footprint needs matched-star verification before a detail patch is composed.

## High-resolution LMC master experiment

The **LMC · master 1024** and **LMC · master 512** subjects bypass the old 384-cell RGB grid. They extract directly from the pinned 6737×6536 TIFF at native spatial resolution, sample that photograph independently of the coarse simulated depth field, and bake 2048-pixel lossless PNG masters. The 1024- and 512-pixel delivery banks are then area-downsampled from the verified PNG bytes with premultiplied alpha and encoded as WebP. Both use the same 192 prepared slabs and existing CSS renderer; their image payloads are 2.60 MB and 0.69 MB respectively (42.9 MB and 10.3 MB decoded).

The selected native 7-pixel median retains more filaments than the 19-pixel kernel that approximately matches the old filter's angular scale. It also retains more stellar contamination: this is frequency separation, not membership-based foreground-star subtraction. Native TIFF input does not imply 16-bit scientific radiometry throughout; extraction and slab masters contain 8-bit display RGB/alpha.

The experiment retains the baseline physical bounds, alignment, exposure and depth-model parameters. Higher resolution does not recover measured gas/dust depth. Spreading photographic features through stellar depth still causes perspective streaking, and two integration samples per slab can alias fine features in side banks. These candidates demonstrate the resolution pipeline; they are not final optical reconstructions.

From a clean checkout, with the manually downloaded simulation archive in Downloads:

```sh
pnpm install --frozen-lockfile
pnpm build:preparation
pnpm lab:nebula:images
pnpm lab:nebula:particles labs/nebula/models/magellanic-particles.json "$HOME/Downloads/lsmcmodelA2020_2500Myr.zip" lmc-particles
pnpm lab:nebula:master labs/nebula/models/lmc-highres.json
pnpm test:lab:nebula
pnpm lab:nebula
```

Open <http://127.0.0.1:4331/?subject=lmc-highres-1024>. The original particle bake remains in the Subject chooser. Large originals, full-resolution extractions, density intermediates and lossless masters stay in the ignored local cache; only the small delivery banks, recipes and provenance are checked in. Re-running the master command verifies cached PNGs and derives delivery again. A changed source, master setting or pipeline implementation creates a new master cache; changing only delivery width or quality reuses the same master.
