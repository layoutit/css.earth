# Helix: compare image fitting with a geometric depth prior

**New first-stage inspector:** [nebula compiler method, reproduction and next steps](../../docs/nebula-compiler.md). Open this object's **Structure map** to inspect the full starless frame, diffuse emission, arcs, compact candidates and unassigned signal. The **Volume** button still shows the earlier baseline below; no new 3D hypotheses are claimed.

**Initial visual verdict: neither baseline is accepted.** The one-axis fit reproduces the photograph but becomes a box from the side. The disk/ring prior has finite curved components, but is too smooth, cuts off outer emission and changes brightness under rotation. These are deliberately visible comparisons, not production nebula assets.

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
