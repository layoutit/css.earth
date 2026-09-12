# Helix: observation alignment and shape inference

**Current step:** compare the automatic molecular-wall candidates at `/reconstruction?subject=helix-model-prior&inspection=joint`. Image ridges and measured HCO+ velocities jointly constrain a coarse shell or waisted lobe model, with withheld residuals beside the rotatable volume. The earlier manually tuned cloud remains at `fit=helix-tuned`; **Volume** retains the cropped Hubble experiment. None is an accepted physical reconstruction.

**Initial visual verdict: neither baseline is accepted.** The one-axis fit reproduces the photograph but becomes a box from the side. The disk/ring prior has finite curved components, but is too smooth, cuts off outer emission and changes brightness under rotation. These are deliberately visible comparisons, not production nebula assets.

## Combined observations and measured velocities

Open `/reconstruction?subject=helix-model-prior&inspection=combined` for the three-image evidence map, or `inspection=kinematics` for the measured core slit. [Workflow and limits](../../docs/multimodal-workflow.md) explain the shared sky grid, source weights and saved jobs. [kinematics-oiii.json](kinematics-oiii.json) preserves the figure-9 digitization; [kinematics-hco.json](kinematics-hco.json) pins the separate Zeigler et al. (2013) molecular component catalogue. The [joint-fit method](../../docs/joint-fit.md) explains the 279 measured components, source-count discrepancy, beam approximation, conditional surfaces and failures. This is a coarse molecular-wall comparison, not a complete Helix reconstruction.

## Saved coarse fit · 2026-09-12

[tuned-shape-fit.json](tuned-shape-fit.json) stores the fit adjusted through the running workbench: a main annulus, faint cavity, northwest/southeast rim sectors, diffuse envelope and outer northwest arc. Arc length/angle control finite 3D ring sectors with soft ends. Image registration stays unchanged. The widths, depths, weights and arc extents are authored hypotheses, not measured gas geometry.

**Fit → Automatic · my edits** returns to detector-driven work. Saved-fit edits use a separate browser namespace and survive refresh; **Reset to saved fit** restores the checked-in settings. Loading the fit checks the exact image, map, geometry and source-grid identities before processing. Changed source evidence requires revalidation. Only the recipe is tracked; textures and results remain in the ignored cache.

The actual front, oblique and side renders were inspected with `ring-sectors@2` sampling. The main ring/cavity and uneven rim are represented, but the envelope is smooth, fine filaments are absent, and the textured side view still shows slab structure. This is a coarse fit for further inspection, not an accepted physical reconstruction. The full-frame luminance comparison is 0.569 normalized RMSE, 55.8% missing and 5.6% excess; residual stars and background contribute, so these numbers cannot establish nebular accuracy.

`browser-shape-cloud-fit` verifies direct loading, source identity, completed-result reuse on refresh, independent automatic/preset edits, reset and rotation without processing. Its screenshots and receipt stay in `.local/nebula-lab/helix-tuned/`. The [earlier detector-only trial](../../docs/helix-fitting-trial.md) remains a separate historical failure.

## Wider source candidates

The current Hubble/CTIO **photograph itself clips the wider nebula**. Retaining its full frame in the inspector does not repair that missing observation. The separate disk/ring prior also drops signal within that frame; both limits must be fixed before accepting a volume.

Historical publisher previews remain in **Helix · symmetry baseline → Source candidates**, or `/reconstruction?subject=helix-single-axis&inspection=sources`. These are unprocessed full photographs independently fitted to the viewport, not registered overlays. Use **Helix → Alignment** for current source comparison at a shared sky scale. Field sizes describe angular coverage; a small preview must never become the processing input.

| Observation | Native pixels | Publisher field | Inspection result |
| --- | --- | --- | --- |
| [Hubble / CTIO · current](https://esahubble.org/images/opo0432b/) | 4731 × 3129 | 20.96′ × 13.86′ | Crops the outer nebula. Keep for central detail and comparison. |
| [ESO WFI · optical B/V/R](https://www.eso.org/public/images/eso0907a/) | 7059 × 6535 | 28.02′ × 25.94′ | Sharp main ring and northeast arc; still tight for faint outer structures. |
| [ESO 3.6 m · wider field](https://www.eso.org/public/images/helix/) | 6850 × 4759 | 48.82′ × 33.92′ | More surrounding sky, but softer, weaker outer emission and visible artifacts. Filters are not listed by the publisher. |
| [ESO VISTA · near-infrared Y/J/K](https://www.eso.org/public/images/eso1205a/) | 6592 × 6592 | 37.51′ × 37.51′ | Best coverage/detail compromise of these wider previews; different emission and colors from optical. |

The recommendation is to inspect VISTA for extended structure and retain WFI as an optical detail candidate. This is a visual judgment, not a claim of complete all-band coverage. [Zhang, Hsia & Kwok (2012)](https://arxiv.org/abs/1207.4606) report a roughly 40′ halo at 12 μm; even VISTA's wider frame cannot establish that the entire halo is included. A sufficiently large field and sufficient sensitivity to the intended emission are separate requirements.

[Source-candidates metadata](source-candidates.json) records preview URLs, exact preview byte hashes, native links, field sizes, credits and terms. Previews use the ignored local cache when available, otherwise the publisher URL; no image processing is launched by selection. Before processing a chosen replacement: acquire/hash its native original, verify sky orientation and central-star registration, inspect the intended outer boundary, then explicitly remove stars and recompute evidence. Do not reuse the cropped source's pixel coordinates or NOX cache identity.

Other inspected references: the [CFHT/Coelum optical composite](https://www.cfht.hawaii.edu/HawaiianStarlight/AIOM/English/CFHT-Coelum-AIOM-Mar2017.html) still clips its upper extended structures; its public high-resolution version requires a request. [Chatzifrantzis's 2025 APOD](https://apod.nasa.gov/apod/ap250729.html) shows strong optical outer structure, but the published image is watermarked and has no supplied astrometric registration; it is credited to the photographer, not a NASA observation. Neither is a processing input.

## Current step: aligned observations and native star removal

Open `/alignment?subject=helix-model-prior`. The **Image** dropdown shows one aligned photograph at a time. Switching keeps the camera and sky scale unchanged; there is no background reference image. **Matched stars** displays measured counterparts; pan/zoom to inspect them. Original / Without stars / Residual use the same native-pixel transformation. Fine adjustments and copied positioning remain separate from the measured fit. **Reload prepared layers** loads completed processing without changing the camera or local adjustments.

The [observation recipe](observations.json) pins the three complete native ESO TIFFs. Their embedded AVM tangent-plane coordinates include reference-pixel offsets: the page's RA/Dec is not necessarily the raster center. In particular, WFI's reference pixel is displaced vertically by approximately 182 native pixels. The common reference is WFI's published sky frame. The implementation projects embedded WCS, matches compact field-star patterns, fits an affine correction using training stars, and checks a separate spatially distributed holdout. It preserves all original image edges; no source is cropped or rotated into a new native raster.

| Relative alignment to WFI | Matches | Held-out stars | Held-out RMS | Maximum error |
| --- | --- | --- | --- | --- |
| VISTA | 2,380 | 794 | 0.097 frame px = 0.34″ | 0.465 frame px |
| Wider ESO | 686 | 229 | 0.313 frame px = 1.10″ | 1.157 frame px |

Both checks span all four quadrants and a broad overlap. The 1024 × 1024 reference frame spans 60′ square; one frame pixel is 3.515625″. Field stars verify relative registration in the common observed area. Absolute astrometry remains publisher metadata, and regions beyond the common overlap use that WCS plus the fitted correction. No physical depth, common emission strength or stellar membership is inferred.

All three full-native NOX separations completed: approximately 52.6 s for VISTA, 51.9 s for WFI and 36.9 s for the wider ESO image. Native dimensions, tile coverage and source = diffuse + residual accounting passed. The nine 2048-pixel-or-smaller inspection images preserve full aspect/coverage and have recorded hashes. **Bright stellar cores/halos remain in places; some compact nebular knot light enters the residual.** The user authorized a first structure-inspection pass using these inputs; their contamination must remain visible as uncertainty. Optical/infrared differences are also real band differences, not evidence of misregistration.

To recreate this step from the repository root with Node, pnpm and Python 3.9–3.12 installed:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/helix/observations.json --alignment-only
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/helix/observations.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-observation-structures labs/nebula/models/helix/observation-structures.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-kinematics labs/nebula/models/helix/kinematics-oiii.json
node --experimental-strip-types labs/nebula/src/run.ts molecular-acquire labs/nebula/models/helix/kinematics-hco.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-joint-fit labs/nebula/models/helix/joint-fit.json .local/nebula-lab/observations/helix/structures/catalogue.json
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

The first preparation command acquires/verifies native originals and alignment without starting NOX; it also preserves existing separation layers after validating their matching receipts. The second explicitly performs native separation or validates/reuses its completed cache. Omit the server command if the lab already runs. New observations, native outputs, previews and correspondence receipts stay ignored under `.local/nebula-lab/observations/helix/`. Recipes and shared TypeScript remain tracked. Adding another object uses another recipe and an `observationAlignment` configuration; Alignment requires no baked volume.

Browser verification passed for all nine real layers, identical transforms and retained image nodes, full footprints, matched markers, pan/zoom, reload, saved manual adjustments/copy, and navigation among the density/symmetry/inference examples. Helix inspection issued no processing requests and loaded Alignment without a baked volume. A cache-only replay retained every completed layer and launched no inference. Removing the AVM offset path and the no-processing guard each makes a focused test fail. These checks establish registration/display/replay behavior, not star-removal quality or physical depth.

The user authorized extraction of the new observations on 2026-09-11 and the subsequent joint-fit experiment on 2026-09-12. Keep the old Hubble volume distinct. Neither matching stars nor keeping a projected feature establishes the nebula's 3D form; the next decision uses the [joint model's residuals](../../docs/joint-fit.md).

## Difficulty and scientific basis

Helix is not wholly asymmetric. [O'Dell, McCullough & Meixner (2004)](https://doi.org/10.1086/424621) propose a 499″ inner disk and 742″ outer ring, with different inclinations and axes. We inspected sections 3.1 and 4.6 directly. Their inner and outer inclinations to the sightline are 23° and 53°, with near-side position angles 288° and 168°.

That is one interpretation. [O'Dell (2005)](https://arxiv.org/abs/astro-ph/0505539) discusses the outer-geometry ambiguity. [Meaburn et al. (2005)](https://arxiv.org/abs/astro-ph/0504295) fit a bipolar structure with a toroidal waist using spatially resolved spectroscopy. [Herschel observations (2015)](https://www.aanda.org/articles/aa/full_html/2015/02/aa24189-14/aa24189-14.html) discuss a barrel interpretation. The latter alternatives have been identified from their published summaries, not implemented here.

The computation is modest; constraining believable depth is the hard part. A front-facing image plus one symmetry axis cannot establish Helix's multiple components or individual knot depths. A manually constructed prior supplies those assumptions; it does not recover them from the photograph.

## Reproduce both local trials

From the repository root with Node, pnpm and Python 3.9–3.12 installed:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts test solver shape-prior
node --experimental-strip-types labs/nebula/src/run.ts prepare-emission labs/nebula/models/helix/single-axis.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-emission labs/nebula/models/helix/model-prior.json
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

If the lab is already running, keep it alive and omit the last command. Choose **Helix · one-axis fit** or **Helix · disk/ring prior** in the object menu. Their shared comparison frame retains the camera while switching. Original/diffuse/residual native images remain in `.local/nebula-lab/research/helix/nox/`; the original TIFF remains hash-pinned and unchanged. Both models reuse that verified native separation. The same explicit command regenerates a missing separation, rather than requiring a manually supplied starless image.

## Observation and registration

- [ESA/Hubble image opo0432b](https://esahubble.org/images/opo0432b/), HST/ACS plus CTIO Mosaic II: full 4731 × 3129 RGB8 TIFF. Original SHA-256: `3dfe0b4a06ff2d57c35324e76975565f253b78302eab7ec5ac4d2d2c47227165`.
- Full credit: NASA, ESA, C.R. O'Dell (Vanderbilt University), and M. Meixner, P. McCullough, and G. Bacon (Space Telescope Science Institute). Follow [ESA/Hubble's usage terms](https://esahubble.org/copyright/); the complete credit is visible in the lab.
- Publisher footprint: 20.96′ × 13.86′, north 0.1° right of vertical. Central-star peak in the unmodified original: `(2465,1524)`, zero-based pixel centers. The source contains the bright main nebula and only part of the wider halo. It is a stretched outreach composite, not calibrated spectral intensity.
- The original was inspected before processing; the native NOX comparison was inspected before fitting. Preserve bright nebular knots for a later dedicated extraction audit: the neural separation is not a foreground-star classifier.
- No image rotation, mirror or crop is applied. The central-star coordinate maps with `(pixel + 0.5) * workingSize / nativeSize - 0.5`. The 144 × 95 working raster rounds the source aspect by approximately 0.25%; it is a low-resolution method trial.
- The model uses image-local axes, not a measured global 3D location. With raster x right/y down/z toward the observer, a ring's unit normal is `[sin(PA−0.1°)sin(i), cos(PA−0.1°)sin(i), cos(i)]`, making the published near side project in the correct sky direction.

## What is fitted and what is assumed

**One-axis fit:** the existing Wenger 2013 implementation, using the inner disk's published axis. Both RGB channels and background light enter the fit. The inappropriate single-axis prior leaves a depth-distributed photographic box; increasing image resolution will not fix that ambiguity.

**Disk/ring prior:** a filled inner disk, its toroidal rim, and the differently tilted outer torus. Diameters, axis inclinations and near-side directions come from the 2004 paper. Gaussian cross-sections, widths, relative weights and cutoff are explicitly authored in the recipe, not measured gas density. The full outer halo and vertical lobes are not represented.

For each image ray, the prepared source RGB is distributed in proportion to the prior's depth weights. Empty support stays empty. Consequently front agreement on supported rays is imposed by construction; it is not evidence that the depth is correct. The prior remains unchanged when the image changes. The renderer samples the resulting RGB voxel field for every XYZ bank, never a stack of repeated source images.

## First run and next decision

Native NOX took 22.4 seconds over 117 tiles, including encoding; both fits share its result. One-axis fitting took 14.6 seconds, 18.3 seconds through baking. The geometric allocation/bake took 3.4 seconds. Per-channel front relative L2 errors: single-axis 3.86/4.76/4.85%; prior 41.95/17.32/17.47%. The latter loses 25.75/9.98/10.57% of total R/G/B signal outside its modeled support. These numbers are not physical mass fractions.

Both browser checks passed transport, retained PolyCSS rotation and refresh without processing. Screenshots at Front, Y +60°, Edge X and Edge Y were inspected. The visual failures above remain. Current tests protect the prior's empty center, absent support and unchanged depth when RGB changes. No independent scientific validation is claimed.

One baseline per method has been produced; at most two controlled adjustments remain. The next useful change is to decide which published geometry to investigate, then add the missing extended components and constrain their thickness. Improving the prior may help the large shape; restoring knot-scale detail needs additional structure and observations. Do not try to rescue wrong geometry with exposure sliders or a larger bake.
