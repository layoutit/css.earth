# Helix: conditional emission compiler

This lab model studies how to turn Helix Nebula photographs into a 3D emission cloud. The [shipped object record](../../../../src/objects/helix-volume/README.md) owns the active sources, delivery evidence and known problems.

Open `/reconstruction?subject=helix-model-prior&inspection=compiler`. **Nebula → Compile nebula** runs the configured sources through separation, evidence, an optional velocity scaffold, positive multiscale emission fitting and a shared three-dataset bake. The [compiler method and complete setup](../../docs/emission-compiler.md) describe jobs, replay and assumptions. Visual acceptance is still open, and no compiled result is a production nebula asset.

## Compiler inputs and interpretation

[compiler.json](compiler.json) combines the registered ESO WFI optical, wider ESO field and VISTA infrared sources from [observations.json](observations.json), with WFI as the initial RGB dataset. [joint-fit.json](joint-fit.json) supplies the optional molecular scaffold from HCO+ measurements. Up to 650 compact lights are allowed; this is a display budget, not a measured stellar population.

The three normalized starless images form one relative-luminosity target. A positive multiscale fit supplies projected emission, and the molecular surface conditions its depth. Equal front/back allocation, support thickness and the diffuse prior for unsupported emission are assumptions, not a measured shell. All three datasets share one 3D field; their colours are different observations, not extra viewpoints. Compact-light depths do not measure stellar distance or membership.

Known limits of the compiled cloud: VISTA shows oblique colour streaks, bright stellar halos survive in the inputs, and fine knots and depth are not recovered. Increasing slab sampling does not fix the source-to-volume colour interpretation.

## Combined observations and velocities

Open `inspection=combined` for the three-image evidence map or `inspection=kinematics` for the core slit. See [workflow and limits](../../docs/multimodal-workflow.md). [kinematics-oiii.json](kinematics-oiii.json) keeps the figure-9 digitization; [kinematics-hco.json](kinematics-hco.json) pins the Zeigler et al. (2013) molecular component catalogue. The [joint-fit method](../../docs/joint-fit.md) explains the 279 measured components and the fit's limits.

[tuned-shape-fit.json](tuned-shape-fit.json) stores a hand-tuned fit: a main annulus, faint cavity, northwest/southeast rim sectors, diffuse envelope and outer northwest arc. Its widths, depths, weights and arc extents are authored hypotheses. **Reset to saved fit** restores the checked-in settings.

## Source candidates

The Hubble/CTIO photograph clips the wider nebula, which led to the wider ESO selection. Publisher previews are under **Helix · symmetry baseline → Source candidates**. They are unregistered; use **Helix → Alignment** to compare sources at a shared sky scale.

| Observation | Native pixels | Publisher field | Inspection result |
| --- | --- | --- | --- |
| [Hubble / CTIO · historical baseline](https://esahubble.org/images/opo0432b/) | 4731 × 3129 | 20.96′ × 13.86′ | Crops the outer nebula. Keep for central detail and comparison. |
| [ESO WFI · optical B/V/R](https://www.eso.org/public/images/eso0907a/) | 7059 × 6535 | 28.02′ × 25.94′ | Sharp main ring and northeast arc; still tight for faint outer structures. |
| [ESO 3.6 m · wider field](https://www.eso.org/public/images/helix/) | 6850 × 4759 | 48.82′ × 33.92′ | More surrounding sky, but softer, weaker outer emission and visible artifacts. Filters are not listed by the publisher. |
| [ESO VISTA · near-infrared Y/J/K](https://www.eso.org/public/images/eso1205a/) | 6592 × 6592 | 37.51′ × 37.51′ | Best coverage/detail compromise of these wider previews; different emission and colors from optical. |

[Zhang, Hsia & Kwok (2012)](https://arxiv.org/abs/1207.4606) report a roughly 40′ halo at 12 μm, so even VISTA's frame may not hold the whole halo. [Source-candidates metadata](source-candidates.json) records preview URLs, native links, field sizes, credits and terms. Before processing a replacement, acquire its native original, verify orientation and central-star registration, then remove stars and recompute evidence. Do not reuse the cropped source's pixel coordinates or NOX cache identity.

## Aligned observations and native star removal

Open `/alignment?subject=helix-model-prior`. The [observation recipe](observations.json) pins the three native ESO TIFFs. Their AVM coordinates include reference-pixel offsets, so the page's RA/Dec is not necessarily the raster centre. The code projects embedded WCS onto WFI's sky frame, matches field-star patterns, fits an affine correction and checks a separate holdout. No source is cropped or rotated.

| Relative alignment to WFI | Matches | Held-out stars | Held-out RMS | Maximum error |
| --- | --- | --- | --- | --- |
| VISTA | 2,380 | 794 | 0.097 frame px = 0.34″ | 0.465 frame px |
| Wider ESO | 686 | 229 | 0.313 frame px = 1.10″ | 1.157 frame px |

One frame pixel is 3.515625″. Absolute astrometry is publisher metadata. Bright stellar cores and halos remain in places, and some compact knot light enters the residual. Optical and infrared differences are real band differences, not misregistration.

The [complete compiler setup](../../docs/emission-compiler.md#reproduce-from-a-clean-checkout) restores these stages; for inspection only, use the [structure guide's sequence](../../docs/nebula-compiler.md). New observations stay ignored under `.local/nebula-lab/observations/helix/`.

## Scientific basis

[O'Dell, McCullough & Meixner (2004)](https://doi.org/10.1086/424621) propose a 499″ inner disk and 742″ outer ring, inclined 23° and 53° to the sightline, with near-side position angles 288° and 168°. Only this geometry is implemented; [O'Dell (2005)](https://arxiv.org/abs/astro-ph/0505539), [Meaburn et al. (2005)](https://arxiv.org/abs/astro-ph/0504295) and [Herschel observations (2015)](https://www.aanda.org/articles/aa/full_html/2015/02/aa24189-14/aa24189-14.html) offer alternatives. A front-facing image plus one symmetry axis cannot establish Helix's components or knot depths.

## Reproduce the one-axis and disk/ring trials

From the repository root with Node, pnpm and Python 3.9–3.12:

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

If the lab is already running, omit the last command. Choose **Helix · one-axis fit** or **Helix · disk/ring prior**. Native NOX images stay in `.local/nebula-lab/research/helix/nox/`.

The trials use [ESA/Hubble image opo0432b](https://esahubble.org/images/opo0432b/) (HST/ACS plus CTIO Mosaic II), credit NASA, ESA, C.R. O'Dell (Vanderbilt University), and M. Meixner, P. McCullough, and G. Bacon (Space Telescope Science Institute), under [ESA/Hubble's usage terms](https://esahubble.org/copyright/). It is a stretched outreach composite, not calibrated intensity. No rotation, mirror or crop is applied.

The **one-axis fit** uses the Wenger 2013 method with the inner disk's axis; it becomes a box from the side. The **disk/ring prior** uses the 2004 geometry with authored cross-sections and spreads image light along each ray, so front agreement is imposed by construction, not evidence of depth. It is too smooth, cuts off outer emission and changes brightness under rotation. Neither baseline is accepted. Do not try to rescue wrong geometry with exposure sliders or a larger bake.
