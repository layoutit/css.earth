# HD 181327 debris ring

## Sources

This package draws the ring of debris around [HD 181327](../hd-181327/README.md) as a prepared volume attached to the star, the way [Betelgeuse's circumstellar volumes](../betelgeuse-shell/README.md) are: it has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Debris ring · JWST 1.8–4.4 µm".

- **Images:** MAST's six level-3 coronagraph mosaics of observation c1014 in GTO programme 2780 (Gáspár et al. 2026, [arXiv:2608.27437](https://arxiv.org/abs/2608.27437)): JWST/NIRCam F182M, F210M, F250M, F300M, F335M and F444W behind the MASK335R coronagraph, 11 October 2023. They are pinned, with the coron3 associations and exposures they were built from, in [`hd-181327-2780.json`](../../../tools/objects/jwst/imaging/programs/hd-181327-2780.json). The files are downloaded into `.local/hd-181327-disc/observations/` and pinned by digest in the [manifest](source/manifest.json).
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the program, which bands feed which colour, the display, the drawn inner edge and its source, the stated conventions and the published geometry the measurement is checked against. [`tools/objects/circumstellar/author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**Reproduced here.** [`coron3.mts`](../../../tools/objects/jwst/imaging/coron3.mts) re-ran the pipeline's coronagraphy stage for each band from the archived exposures on the pinned toolchain; every PSF alignment fit converged and every result is on MAST's grid. Against MAST's mosaics (the `hd-181327-2780.NIRCAM-*-MASK335R.reproduction.json` receipts beside the [program](../../../tools/objects/jwst/imaging/programs/hd-181327-2780.json)):

| band | correlation above the median | 0.5–1″ | 1–2″ (the ring) | 2–5″ | 5–20″ |
|---|---|---|---|---|---|
| F182M | 0.961 | 0.46 | 0.979 | 0.976 | 0.870 |
| F210M | 0.965 | 0.48 | 0.970 | 0.979 | 0.737 |
| F250M | 0.996 | 0.76 | 0.987 | 0.999 | 0.999 |
| F300M | 0.994 | 0.73 | 0.969 | 0.996 | 0.999 |
| F335M | 0.993 | 0.82 | 0.968 | 0.998 | 0.998 |
| F444W | 0.978 | 0.86 | 0.887 | 0.989 | 0.994 |

MAST's products are the ones drawn. Inside 1″ the two independent subtractions of the same exposures disagree, so the light there is starlight left over after subtraction, which differs from band to band; nothing is drawn inside 1″ (47.8 au).

**Placement.** One volume unit is one astronomical unit at the star's prepared distance (47.78 pc), and the cube (±140 au) is anchored on the star's scene origin, so the star's sphere sits at its centre by construction. The mosaics are rotated against north, so each is read about the star through its own WCS, not flipped; the star's position in them is the observation's target position (`TARG_RA`, `TARG_DEC`), which carries the proper motion to the epoch of the images.

**Colour.** The six bands are combined the way the repository's sky-band composites are ([colour preparation](../../../docs/color-preparation.md#sky-survey-bands)): red is F335M + F444W, green F250M + F300M, blue F182M + F210M. Each band has its measured background (the median 5–8″ from the star) subtracted and is divided by the 99.9th percentile of its own drawn samples, and the three channels go through the shared Lupton et al. (2004) asinh display with M8's settings (stretch 0.1, softening 8). Hue therefore shows where each group of bands is bright relative to its own range, not a colour of the dust: the warmer outer edge is the halo of small grains being relatively brighter at the longer wavelengths.

**The ring, measured on the mean of the six bands.** The ridge, the radius of peak brightness in each azimuth under nine binnings, traces an ellipse. A circular ring seen at inclination *i* projects to an ellipse of axis ratio cos *i* whose major axis is the line of nodes:

| | measured here | Gáspár et al. (2026) |
|---|---|---|
| radius | 80.9 au | 80 au (ring 75–85 au) |
| inclination | 29.0° | 28.54° ± 0.31° |
| position angle of the nodes | 100.6° | 100.39° ± 0.63° |

The nine binnings scatter by 0.07 au, 0.14° and 0.42°, and each band measured alone gives 80.3–81.1 au, 28.1–30.1° and 98.8–102.3°. A mirrored reading of the mosaics would put the nodes near 80°, so east is where the paper has it. The author refuses a ring more than 5° or a tenth of the radius from the published one.

**Depth: a shape fitted to the images, not the images pushed backwards.** Candidate envelopes are projected through the cube and scored against the mean image, each at its own best gain, between 1″ and 120 au:

| envelope | residual against a signal of 0.485 (band-normalised) |
|---|---|
| inclined ring of the measured geometry, gaussian radial width 22.7 au | 0.104 |
| spherical shell, radius 91 au | 0.127 |
| constant depth, what an extrusion assumes | 0.218 |

The ring wins and is drawn: each sky column's three colours are spread along it with one depth profile and normalised so the column keeps its displayed colour, so the view from Earth reproduces the images and every other direction shows a ring. The residual stays well above the noise because the real ring is brighter on one side and carries a halo; those are kept as measured, and the model supplies only the depth. The volume is baked as 48 slices an axis: with 24, a tilted view showed the gaps between slices through the thin ring as stripes, which 48 reduced about fivefold in a rendered capture.

## Evidence

- [`disc-envelope.test.mts`](../../../tools/objects/circumstellar/disc-envelope.test.mts): a synthetic inclined ring is recovered from its own projection (radius, inclination, position angle, centre, width), the stated near side lies toward the observer, a spherical shell is refused as a ring, and a ridge of noise is refused.
- [`imaging.test.mts`](../../../tools/objects/jwst/imaging/imaging.test.mts): coron3 programs parse, and the occulter is read from the observation's name.
- `node tools/objects/circumstellar/author.mts hd-181327-disc --check` reproduces the grid, recipe, delivery, presentation, preview and manifest.
- Rendered in the application (headless Chrome, 1440 × 900) at 350 au face-on and tilted, with no console errors.

## Known problems

- **Which side is nearer is a convention.** One image cannot say which end of the minor axis tilts toward us; the south-south-west side is drawn nearer. A scattering phase function fitted to the brightness asymmetry would decide it ([ledger](investigations.json)).
- **The ring's thickness is a convention** (0.05 of its radius): the mean image changes by 0.4% across heights from 0.02 to 0.2.
- **The composite does not measure ice.** Water ice absorbs near 3 µm, in the green channel, and Gáspár et al. measure it across these filters; hue here is each band's brightness relative to its own range.
- **Nothing is drawn inside 1″**, where the subtraction leaves more starlight than there is dust.
- MIRI coronagraphy of this disc is excluded: the pipeline's alignment does not converge on it ([JWST imaging](../../../docs/jwst-imaging.md#measured)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
