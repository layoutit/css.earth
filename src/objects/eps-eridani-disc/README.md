# ε Eridani dust ring

## Sources

This package draws the belt of dust around [ε Eridani](../eps-eridani/README.md) as a prepared volume attached to the star, the way the [PDS 70 ring](../pds-70-disc/README.md) is. It has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Dust ring · ALMA 1.3 mm". [Planet b](../eps-eridani-b/README.md) orbits at 3.5 au, far inside it.

- **Image:** the ALMA pipeline's band 6 continuum image of project 2019.1.00696.S (PI M. Booth), member OUS `uid://A001/X1465/X27ff`. The 12-m array observed five times between 16 and 23 December 2019, in six pointings around the star. The image has 0.19″ pixels and a 1.288″ × 0.955″ beam (CASA 5.6.1-8). It is the public archive's product, together with its primary beam, downloaded from the ALMA data portal into `.local/eps-eridani-disc/observations/`. Booth et al. (2023, MNRAS 521, 6180; [arXiv:2303.13584](https://arxiv.org/abs/2303.13584)) published these observations but deposited no image. Theirs uses natural weighting, a 1.6″ × 1.2″ beam and multiscale CLEAN, and reaches 14 µJy per beam of noise.
- **Processing:** the three point sources of their Table 2 are removed as they model them: the star itself (1020 µJy, which they conclude is the star's photosphere, chromosphere and corona) and two background sources (990 and 270 µJy). Each is removed as the image's own beam at its published position and peak. Their Figure 1 is shown without the primary-beam correction, so the image is multiplied by the product's own primary beam. It is then smoothed to their beam and rescaled to Jy per that beam. At their resolution its noise is 16.4 µJy per beam in the 4 to 12″ annulus. Sky fainter than that fades out: a column is drawn in full from twice the noise, so the empty sky around the ring is not drawn as dust. This is a display choice, as on the [β Pictoris disc](../beta-pictoris-disc/README.md). Without it, the noise filled the whole disc and the edges of the volume's slices showed as dark arcs.
- **Colour:** the colour map and scale of their Figure 1 (left panel). Its colour bar was decoded from the figure's PDF in the paper's arXiv source: matplotlib's inferno, all 256 colours to 0 of 255, linear from −50.66 to 90.00 µJy per beam ([booth-2023-figure-1-colormap.json](source/booth-2023-figure-1-colormap.json) records how it was read).
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the image, the point sources, the beam, the colour map and the published geometry. [`author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**The ring is Booth et al.'s, not measured here.** In this image the ring's ridge rises above five times the per-pixel noise in only 5 of 24 directions, too faint to trace. So the drawn ring takes the geometry Booth et al. fitted to these same observations (Table 3): radius 69.6 au, 10.5 au wide at half maximum, tilted 33.7°, nodes at position angle −1.1°. On this image a disc of that geometry that follows the image's own radial profile leaves a residual of 1.50 × 10⁻⁵ Jy per beam, against 1.68 × 10⁻⁵ for a spherical shell and 1.73 × 10⁻⁵ for constant depth.

**Thickness: Wolff et al.'s model, not a measurement.** At 34° the ring's thickness cannot be resolved. The ALMA survey of vertical structure ([ARKS III](https://arxiv.org/abs/2601.12128)) measured it only for discs seen nearly edge-on. The one published number for this belt is the setting of the dynamical model Wolff et al. (2025, AJ 170, 244, Table 4; [arXiv:2509.24976](https://arxiv.org/abs/2509.24976)) run for it: orbital inclinations with a standard deviation of 0.087 radians. That spreads the dust a root-mean-square 0.087/√2 = 0.0615 of the radius above and below the plane, which is the drawn height.

**Near side: planet b's plane.** Wolff et al. take the belt to be nearly coplanar with planet b. The planet's orbit (Thompson et al. 2025, AJ 170, 301, Table 3: inclined 40°, ascending node at 186°) lines up with the ring (33.7°, −1.1°), and as this application draws it, it comes nearest the observer at position angle 96°. So the ring's east side is drawn nearer.

One volume unit is one astronomical unit at the star's Gaia DR3 distance (3.22 pc). The cube (±105 au, where the mosaic's data end) is anchored on the star's scene origin. The star is placed at its Gaia DR3 position moved by its proper motion to the observing date, 0.2″ from Booth et al.'s fitted position.

## Evidence

Run of 2026-09-27 (this version):

- The author's preview of the image as drawn, north up, at Booth et al.'s resolution, in their colour scale and with the fade ([previews/dust.png](source/previews/dust.png)), to compare with their [Figure 1](https://arxiv.org/abs/2303.13584).
- The ring rendered in the application around the star, captured headless at 1440 × 900 once the application reported ready, 261 au from the star ([eps-eridani-disc-rendered.png](evidence/eps-eridani-disc-rendered.png)).
- [`disc-envelope.test.mts`](../../../tools/objects/circumstellar/disc-envelope.test.mts): a point source at its published position and peak is removed to nothing; smoothing to a larger beam keeps a point source's peak and scales an even field by the ratio of the beam areas; a published ring width is used as stated.
- `node tools/objects/circumstellar/author.mts eps-eridani-disc --check` reproduces every authored file. The same author reproduces the PDS 70 and HD 181327 rings unchanged.

## Known problems

- **Fainter and noisier than the published figure.** At the same resolution and colour scale, the ring's median is 24 µJy per beam and its brightest spots reach about 60. The noise is 16, so the fade leaves the ring patchy. Booth et al.'s own image is cleaner. Their clumps are not claimed here.
- **The ring's geometry and width are the paper's,** not measured on this image.
- **The thickness is a model's setting** (Wolff et al. 2025), not a measurement, and the near side rests on their coplanarity assumption.
- **The inner warm dust is not shown.** JWST's MIRI images of it (programme 1193; Wolff et al. 2025) are a separate dataset.
- The colours are a colour map for brightness at one wavelength, not colours an eye would see.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
