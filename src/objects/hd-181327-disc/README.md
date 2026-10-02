# HD 181327 debris ring

This package draws the ring of debris around [HD 181327](../hd-181327/README.md) as a prepared volume attached to the star, the way [Betelgeuse's circumstellar volumes](../betelgeuse-shell/README.md) are. It has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Debris ring · JWST reflectance".

## Sources

- **Images:** MAST's level-3 coronagraph mosaics of JWST/NIRCam F182M, F210M, F250M, F300M, F335M and F444W behind the MASK335R coronagraph, 11 October 2023, observation c1014 of GTO programme 2780 (Gáspár et al. 2026, [arXiv:2608.27437](https://arxiv.org/abs/2608.27437)). They are pinned with the coron3 associations and exposures they were built from in [`hd-181327-2780.json`](../../../packages/telescope-cli/src/archives/jwst/imaging/programs/hd-181327-2780.json) and in the [manifest](source/manifest.json).
- **Color:** the paper's own recipe for its Figure 1, the reflectance color of the dust. Each filter is divided by the star's flux in it (their Table 9), which leaves the dust's albedo at that wavelength. The filters are averaged in pairs into blue (F182M, F210M), green (F250M, F300M) and red (F335M, F444W). Figure 1 prints no scale, so its stretch, log(1 + a u) / log(1 + a) with a = 14.1 and u = reflectance / 7.15, was fitted to the published panel by [`fit-figure-stretch.mts`](../../../packages/telescope-cli/authoring/circumstellar/fit-figure-stretch.mts).
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the bands, the stellar fluxes and where they are published, the fitted stretch, the drawn inner edge and the published geometry the measurement is checked against. [`author.mts`](../../../packages/telescope-cli/authoring/circumstellar/author.mts) writes the rest of `source/` from it.

## Processing

**Reproduced here.** [`coron3.mts`](../../../packages/telescope-cli/src/archives/jwst/imaging/coron3.mts) re-ran the pipeline's coronagraphy stage for each filter from the archived exposures. The result correlates with MAST's mosaic at 0.887–0.987 at 1–2″, where the ring is, but only 0.46–0.86 at 0.5–1″. So nothing is drawn inside 1″ (47.8 au). MAST's products are the ones drawn.

**Placement.** One volume unit is one astronomical unit at the star's prepared distance (47.78 pc), and the cube (±300 au) is centred on the star. Each mosaic is read through its own WCS, and its measured background is subtracted.

**The ring.** The ridge, the radius of peak brightness in each azimuth, traces an ellipse. A circular ring seen at inclination *i* projects to an ellipse of axis ratio cos *i* whose major axis is the line of nodes:

| | measured here | Gáspár et al. (2026) |
|---|---|---|
| radius | 80.8 au | 80 au (ring 75–85 au) |
| inclination | 28.6° | 28.54° ± 0.31° |
| position angle of the nodes | 100.7° | 100.39° ± 0.63° |

The author refuses a ring more than 5° or a tenth of the radius from the published one.

**Depth.** The drawn envelope is a disc of that geometry whose surface density follows the image's deprojected radial profile, 0.1 of the radius thick. It is a shape fitted to the images, not the images pushed backwards. Projected and scored against the mean image between 1″ and 120 au:

| envelope | residual against a signal of 2.50 |
|---|---|
| disc following the measured radial profile | 0.456 |
| single gaussian ring, radial width 22.6 au | 0.532 |
| spherical shell | 0.654 |
| constant depth, what an extrusion assumes | 1.131 |

Each sky column's color is spread along the disc and normalised so the view from Earth reproduces the images, and every other direction shows a disc. The light is drawn to 237 au, where the ring's deprojected median reaches the per-pixel noise.

**Opacity** is the one setting the source cannot give. The top of the stretch reaches an alpha of 0.5, the value whose rendered profile matches the figure best. The median drawn line of sight hides 6% of what is behind it.

## Evidence

Rendered from Earth in the application, the ring's long axis lies 77.9° clockwise from up with axis ratio 0.875; the paper's Figure 1 panel gives 78.5° and 0.876 (a mirror would give 101.5°). Luminance correlates at 0.985, and the ring is near-neutral in both.

- [`disc-envelope.test.mts`](../../../packages/telescope-cli/authoring/circumstellar/disc-envelope.test.mts): a synthetic inclined ring is recovered from its own projection, the stated near side lies toward the observer, and a spherical shell or a ridge of noise is refused.
- [`imaging.test.mts`](../../../packages/telescope-cli/src/archives/jwst/imaging/imaging.test.mts): coron3 programs parse, and the occulter is read from the observation's name.
- `node packages/telescope-cli/authoring/circumstellar/author.mts hd-181327-disc --check` reproduces the grid, recipe, delivery, presentation, preview and manifest; `fit-figure-stretch.mts hd-181327-disc reflectance <figure>` reproduces the stretch.

## Known problems

- **Which side is nearer is a convention.** One image cannot say which end of the minor axis tilts toward us; the south-south-west side is drawn nearer ([ledger](investigations.json)).
- **The disc's thickness is a convention** (0.1 of its radius): the images change by 0.6% across heights from 0.02 to 0.2.
- **Softer than the printed figure.** The images carry 1.5 au per pixel (F182M) to 3 au (the long filters); the grid samples at 2.9 au.
- **Darker than the printed figure:** the render is at 0.48 of its brightness, because the renderer ties brightness to how much a column hides.
- **The colors are infrared reflectance, not what an eye would see,** and the composite does not measure the water ice the paper finds.
- **Nothing is drawn inside 1″**, where the subtraction leaves more starlight than there is dust.
- MIRI coronagraphy of this disc is excluded: the pipeline's alignment does not converge on it ([JWST imaging](../../../docs/jwst-imaging.md#measured)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
