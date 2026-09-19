# HD 181327 debris ring

## Sources

This package draws the ring of debris around [HD 181327](../hd-181327/README.md) as a prepared volume attached to the star, the way [Betelgeuse's circumstellar volumes](../betelgeuse-shell/README.md) are: it has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Debris ring · JWST 1.8 µm".

- **Image:** MAST's level-3 coronagraph mosaic of JWST/NIRCam F182M behind the MASK335R coronagraph, 11 October 2023, observation c1014 of GTO programme 2780 (Gáspár et al. 2026, [arXiv:2608.27437](https://arxiv.org/abs/2608.27437)). It is pinned with the coron3 association and exposures it was built from in [`hd-181327-2780.json`](../../../tools/objects/jwst/imaging/programs/hd-181327-2780.json), downloaded into `.local/hd-181327-disc/observations/`, and pinned by digest in the [manifest](source/manifest.json).
- **Colours and scale:** the paper's own, from its Figure 26: the F182M colour bar, logarithmic from −0.79 to 50 MJy/sr. [`colourbar.mts`](../../../tools/objects/circumstellar/colourbar.mts) reads it off the figure (every printed tick within 0.5 pixel of the fitted stretch), and the recipe keeps the numbers with the bar's pixel box and ticks, so the reading can be repeated.
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the band, the colour bar, the drawn inner edge and its source, the stated conventions and the published geometry the measurement is checked against. [`author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**Why F182M.** It is the filter Gáspár et al. fit the ring on (their Figure 27) and the sharpest of the six, 31 mas pixels against 63 for the long-wave filters. The other five filters are re-run and compared the same way (receipts beside the [program](../../../tools/objects/jwst/imaging/programs/hd-181327-2780.json)) and not drawn: they show the same ring.

**Reproduced here.** [`coron3.mts`](../../../tools/objects/jwst/imaging/coron3.mts) re-ran the pipeline's coronagraphy stage from the archived exposures on the pinned toolchain: on MAST's grid, every PSF alignment fit converged, correlation 0.961 with MAST's mosaic above the median brightness and 0.979 at 1–2″, where the ring is. At 0.5–1″ only 0.46: the two independent subtractions of the same exposures disagree there, so nothing is drawn inside 1″ (47.8 au). MAST's product is the one drawn.

**Placement.** One volume unit is one astronomical unit at the star's prepared distance (47.78 pc), and the cube is anchored on the star's scene origin, so the star's sphere sits at its centre by construction. The mosaic is rotated against north, so it is read about the star through its own WCS, not flipped; the star's position in it is the observation's target position (`TARG_RA`, `TARG_DEC`). Its measured background, −1.82 MJy/sr in the 5–8″ annulus, is subtracted so that zero is empty sky, as on the published scale.

**The ring, measured on the image.** The ridge, the radius of peak brightness in each azimuth under nine binnings, traces an ellipse. A circular ring seen at inclination *i* projects to an ellipse of axis ratio cos *i* whose major axis is the line of nodes:

| | measured here | Gáspár et al. (2026) |
|---|---|---|
| radius | 81.2 au | 80 au (ring 75–85 au) |
| inclination | 28.6° | 28.54° ± 0.31° |
| position angle of the nodes | 101.9° | 100.39° ± 0.63° |

The nine binnings scatter by 0.16 au, 0.23° and 0.46°. A mirrored reading would put the nodes near 80°. The author refuses a ring more than 5° or a tenth of the radius from the published one.

**How far the light reaches.** In rings of the disc plane, deprojected with that geometry, the median brightness falls to the per-pixel noise (0.39 MJy/sr) at 186 au. The drawn image tapers from there to the grid edge at 240 au, and the author refuses a grid that would cut light above the noise.

**Depth: a shape fitted to the image, not the image pushed backwards.** Candidate envelopes are projected through the cube and scored against the image, each at its own best gain, between 1″ and 120 au:

| envelope | residual against a signal of 10.0 MJy/sr |
|---|---|
| inclined ring of the measured geometry, gaussian radial width 19.5 au | 2.27 |
| spherical shell, radius 91 au | 2.90 |
| constant depth, what an extrusion assumes | 5.07 |

The ring wins and is drawn: each sky column's four colour channels are spread along it with one depth profile and normalised so the column emits the bar colour of its own brightness, so the view from Earth reproduces the image and every other direction shows a ring.

**Checked against the published figure.** Seen from Earth in the application, the rendered ring's long axis lies 78.9° clockwise from up and its axis ratio is 0.881; the paper's F182M panel gives 80.0° and 0.877, and its published position angle predicts 79.6° (a mirror would give 100.4°). Before any 3D, the sky image in the paper's colours matches their panel with a correlation of 0.950, centred within one figure pixel (mirrored: 0.939). [Evidence](evidence/rendered.json).

**Opacity is the one setting the source cannot give.** In the renderer's emission model a column's brightness and how much it hides are one number, and the real ring blocks a small fraction of a percent of the light behind it. The top of the colour bar is set to reach an alpha of 0.5, the value whose rendered brightness profile matches the paper's panel best: an RMS difference of 0.051 of the ring's peak from 60 to 180 au, against 0.095 at 0.9 and 0.063 at 0.3. The median drawn line of sight then hides 19% of what is behind it. The price is that the render is darker overall than the printed figure, which is an opaque picture.

## Evidence

- [`evidence/rendered.json`](evidence/rendered.json) and [its image](evidence/rendered-from-earth.webp): the ring rendered from Earth and measured against the published panel.
- [`disc-envelope.test.mts`](../../../tools/objects/circumstellar/disc-envelope.test.mts): a synthetic inclined ring is recovered from its own projection (radius, inclination, position angle, centre, width), the stated near side lies toward the observer, a spherical shell is refused as a ring, and a ridge of noise is refused.
- [`imaging.test.mts`](../../../tools/objects/jwst/imaging/imaging.test.mts): coron3 programs parse, and the occulter is read from the observation's name.
- `node tools/objects/circumstellar/author.mts hd-181327-disc --check` reproduces the grid, recipe, delivery, presentation, preview and manifest.

## Known problems

- **Which side is nearer is a convention.** One image cannot say which end of the minor axis tilts toward us; the south-south-west side is drawn nearer. A scattering phase function fitted to the brightness asymmetry would decide it ([ledger](investigations.json)).
- **The ring's thickness is a convention** (0.05 of its radius): the image changes by 1% across heights from 0.02 to 0.2.
- **Darker than the printed figure,** for the reason above.
- **Nothing is drawn inside 1″**, where the subtraction leaves more starlight than there is dust; the paper's panel shows that region with its residuals.
- MIRI coronagraphy of this disc is excluded: the pipeline's alignment does not converge on it ([JWST imaging](../../../docs/jwst-imaging.md#measured)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
