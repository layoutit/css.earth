# HD 181327 debris ring

## Sources

This package draws the ring of debris around [HD 181327](../hd-181327/README.md) as a prepared volume attached to the star, the way [Betelgeuse's circumstellar volumes](../betelgeuse-shell/README.md) are: it has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Debris ring · JWST reflectance".

- **Images:** MAST's level-3 coronagraph mosaics of JWST/NIRCam F182M, F210M, F250M, F300M, F335M and F444W behind the MASK335R coronagraph, 11 October 2023, observation c1014 of GTO programme 2780 (Gáspár et al. 2026, [arXiv:2608.27437](https://arxiv.org/abs/2608.27437)). They are pinned with the coron3 associations and exposures they were built from in [`hd-181327-2780.json`](../../../tools/objects/jwst/imaging/programs/hd-181327-2780.json), downloaded into `.local/hd-181327-disc/observations/`, and pinned by digest in the [manifest](source/manifest.json).
- **Colour:** the paper's own recipe for its Figure 1, the reflectance colour of the dust. Each filter is divided by the star's flux in it (their Table 9), which leaves how the dust reflects starlight at that wavelength, its albedo, and the filters are averaged in pairs into blue (F182M, F210M), green (F250M, F300M) and red (F335M, F444W). Figure 1 prints no scale, so its stretch, log(1 + a u) / log(1 + a) with a = 14.1 and u = reflectance / 7.15, was fitted to the published panel by [`fit-figure-stretch.mts`](../../../tools/objects/circumstellar/fit-figure-stretch.mts): colour error 12.6 of 255, luminance correlation 0.990, mirrored 14.4.
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the bands, the stellar fluxes and where they are published, the fitted stretch and the panel it was fitted on, the drawn inner edge and its source, the stated conventions and the published geometry the measurement is checked against. [`author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**Reproduced here.** [`coron3.mts`](../../../tools/objects/jwst/imaging/coron3.mts) re-ran the pipeline's coronagraphy stage for each filter from the archived exposures on the pinned toolchain: every result on MAST's grid, every PSF alignment fit converged, correlation with MAST's mosaic 0.961–0.996 above the median brightness and 0.887–0.987 at 1–2″, where the ring is. At 0.5–1″ only 0.46–0.86: the two independent subtractions of the same exposures disagree there, so nothing is drawn inside 1″ (47.8 au). MAST's products are the ones drawn.

**Placement.** One volume unit is one astronomical unit at the star's prepared distance (47.78 pc), and the cube (±300 au) is anchored on the star's scene origin, so the star's sphere sits at its centre by construction. Each mosaic is rotated against north, so it is read about the star through its own WCS, not flipped; the star's position in it is the observation's target position (`TARG_RA`, `TARG_DEC`). Each band's measured background (the median 5–8″ from the star) is subtracted.

**The ring, measured on the mean of the three channels.** The ridge, the radius of peak brightness in each azimuth under nine binnings, traces an ellipse. A circular ring seen at inclination *i* projects to an ellipse of axis ratio cos *i* whose major axis is the line of nodes:

| | measured here | Gáspár et al. (2026) |
|---|---|---|
| radius | 80.8 au | 80 au (ring 75–85 au) |
| inclination | 28.6° | 28.54° ± 0.31° |
| position angle of the nodes | 100.7° | 100.39° ± 0.63° |

The nine binnings scatter by 0.10 au, 0.16° and 0.55°. A mirrored reading would put the nodes near 80°. The author refuses a ring more than 5° or a tenth of the radius from the published one.

**Depth: a shape fitted to the images, not the images pushed backwards.** The drawn envelope is a disc of that geometry whose surface density in its own plane follows the image's deprojected radial profile, halo included, 0.1 of the radius thick. Projected through the cube and scored against the mean image between 1″ and 120 au, each at its own best gain:

| envelope | residual against a signal of 2.50 |
|---|---|
| disc following the measured radial profile | 0.456 |
| single gaussian ring, radial width 22.6 au | 0.532 |
| spherical shell | 0.654 |
| constant depth, what an extrusion assumes | 1.131 |

Each sky column's three colour channels are spread along the disc with one depth profile and normalised so the column keeps its colour, so the view from Earth reproduces the images and every other direction shows a disc. The light is drawn to 237 au, where the ring's deprojected median reaches the per-pixel noise; the author refuses a grid that would cut light above the noise.

**Checked against the published figure.** Rendered from Earth in the application, the ring's long axis lies 77.9° clockwise from up with axis ratio 0.875; the paper's Figure 1 panel gives 78.5° and 0.876 (a mirror would give 101.5°). Luminance correlates at 0.985, the brightness profile is within 0.035 of the ring's peak, and the ring is near-neutral in both. [Evidence](evidence/rendered.json).

**Opacity is the one setting the source cannot give.** In the renderer's emission model a column's brightness and how much it hides are one number, and the real ring blocks a small fraction of a percent of the light behind it. The top of the stretch reaches an alpha of 0.5, the value whose rendered profile matches the figure best (0.032 against 0.035 at 0.7). The median drawn line of sight hides 6% of what is behind it, and the render is at 0.48 of the printed figure's brightness.

## Evidence

- [`evidence/rendered.json`](evidence/rendered.json) and [its image](evidence/rendered-from-earth.webp): the ring rendered from Earth and measured against the published panel.
- [`disc-envelope.test.mts`](../../../tools/objects/circumstellar/disc-envelope.test.mts): a synthetic inclined ring is recovered from its own projection, the stated near side lies toward the observer, a spherical shell is refused as a ring, and a ridge of noise is refused.
- [`imaging.test.mts`](../../../tools/objects/jwst/imaging/imaging.test.mts): coron3 programs parse, and the occulter is read from the observation's name.
- `node tools/objects/circumstellar/author.mts hd-181327-disc --check` reproduces the grid, recipe, delivery, presentation, preview and manifest; `fit-figure-stretch.mts hd-181327-disc reflectance <figure>` reproduces the stretch.

## Known problems

- **Which side is nearer is a convention.** One image cannot say which end of the minor axis tilts toward us; the south-south-west side is drawn nearer ([ledger](investigations.json)).
- **The disc's thickness is a convention** (0.1 of its radius): the images change by 0.6% across heights from 0.02 to 0.2. At 0.05 the disc was thinner than the renderer's slice spacing, and a tilted view showed straight strips ending in a hard edge.
- **Softer than the printed figure.** The images carry 1.5 au per pixel (F182M) to 3 au (the long filters); the grid samples at 2.9 au and the slice images at about 3 au.
- **Darker than the printed figure,** for the reason above.
- **The colours are infrared reflectance, not what an eye would see,** and the composite does not measure the water ice the paper finds.
- **Nothing is drawn inside 1″**, where the subtraction leaves more starlight than there is dust.
- MIRI coronagraphy of this disc is excluded: the pipeline's alignment does not converge on it ([JWST imaging](../../../docs/jwst-imaging.md#measured)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
