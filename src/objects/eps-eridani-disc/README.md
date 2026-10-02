# ε Eridani dust ring

This package draws the belt of dust around [ε Eridani](../eps-eridani/README.md) as a prepared volume attached to the star, the way the [PDS 70 ring](../pds-70-disc/README.md) is. It shares the star's frame and is listed among the star's datasets as "Dust ring · ALMA 1.3 mm". [Planet b](../eps-eridani-b/README.md) orbits at 3.5 au, far inside it.

## Sources

- **Image:** the ALMA pipeline's band 6 continuum image of project 2019.1.00696.S (PI M. Booth), member OUS `uid://A001/X1465/X27ff`. The 12-m array observed five times between 16 and 23 December 2019, in six pointings around the star. The image has 0.19″ pixels and a 1.288″ × 0.955″ beam. It is the public archive's product, with its primary beam. Booth et al. (2023, MNRAS 521, 6180; [arXiv:2303.13584](https://arxiv.org/abs/2303.13584)) published these observations but deposited no image. Theirs uses a 1.6″ × 1.2″ beam and reaches 14 µJy per beam of noise.
- **Processing:** the three point sources of their Table 2 are removed as the image's own beam at each published position and peak: the star itself (1020 µJy) and two background sources (990 and 270 µJy). The image is multiplied by the product's own primary beam, as their Figure 1 is shown, then smoothed to their beam. At their resolution its noise is 16.4 µJy per beam. Sky fainter than that fades out: a column is drawn in full from twice the noise, so the empty sky around the ring is not drawn as dust. This is a display choice, as on the [β Pictoris disc](../beta-pictoris-disc/README.md).
- **Color:** the color map and scale of their Figure 1 (left panel), decoded from the figure's PDF: matplotlib's inferno, linear from −50.66 to 90.00 µJy per beam ([booth-2023-figure-1-colormap.json](source/booth-2023-figure-1-colormap.json)).
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the image, the point sources, the beam, the color map and the published geometry. [`author.mts`](../../../packages/telescope-cli/authoring/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**The ring is Booth et al.'s, not measured here.** In this image the ring's ridge rises above five times the per-pixel noise in only 5 of 24 directions, too faint to trace. So the drawn ring takes the geometry Booth et al. fitted to these same observations (Table 3): radius 69.6 au, 10.5 au wide at half maximum, tilted 33.7°, nodes at position angle −1.1°. On this image that geometry leaves a smaller residual than a spherical shell or constant depth.

**Thickness: Wolff et al.'s model, not a measurement.** At 34° the ring's thickness cannot be resolved; the ALMA survey of vertical structure ([ARKS III](https://arxiv.org/abs/2601.12128)) measured it only for discs seen nearly edge-on. The drawn height, 0.0615 of the radius, comes from the orbital-inclination spread of 0.087 radians in the dynamical model Wolff et al. (2025, AJ 170, 244, Table 4; [arXiv:2509.24976](https://arxiv.org/abs/2509.24976)) ran for this belt.

**Near side: planet b's plane.** Wolff et al. take the belt to be nearly coplanar with planet b, whose orbit (Thompson et al. 2025, AJ 170, 301, Table 3) comes nearest the observer at position angle 96°. So the ring's east side is drawn nearer.

One volume unit is one astronomical unit at the star's Gaia DR3 distance (3.22 pc). The cube (±105 au, where the mosaic's data end) is anchored on the star's scene origin. The star is placed at its Gaia DR3 position moved by its proper motion to the observing date, 0.2″ from Booth et al.'s fitted position.

## Evidence

- The author's preview of the image as drawn, north up, at Booth et al.'s resolution and in their color scale ([previews/dust.png](source/previews/dust.png)), to compare with their [Figure 1](https://arxiv.org/abs/2303.13584).
- [`disc-envelope.test.mts`](../../../packages/telescope-cli/authoring/circumstellar/disc-envelope.test.mts) checks point-source removal, beam smoothing and the published ring width.

## Known problems

- **Fainter and noisier than the published figure.** At the same resolution and color scale, the ring's median is 24 µJy per beam and its brightest spots reach about 60. The noise is 16, so the fade leaves the ring patchy. Booth et al.'s own image is cleaner. Their clumps are not claimed here.
- **The ring's geometry and width are the paper's,** not measured on this image.
- **The thickness is a model's setting** (Wolff et al. 2025), not a measurement, and the near side rests on their coplanarity assumption.
- **The inner warm dust is not shown.** JWST's MIRI images of it (programme 1193; Wolff et al. 2025) are a separate dataset.
- The colors are a color map for brightness at one wavelength, not colors an eye would see.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
