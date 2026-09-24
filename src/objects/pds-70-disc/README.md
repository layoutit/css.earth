# PDS 70 dust ring

## Sources

This package draws the ring of dust around [PDS 70](../pds-70/README.md) as a prepared volume attached to the star, the way the [HD 181327 debris ring](../hd-181327-disc/README.md) is: it has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Dust ring · ALMA 0.87 mm". The planets [b](../pds-70-b/README.md) and [c](../pds-70-c/README.md) orbit inside the gap it encloses.

- **Image:** the ALMA pipeline's band 7 continuum image of project 2018.A.00030.S (PI M. Benisty), member OUS `uid://A001/X13b4/Xb1`, observed on 27 July 2019 with the 12-m array in its C-8 configuration: 8.7 mas pixels, a 32 × 27 mas beam, robust 0.5 (CASA 5.6.1-8). It is the public archive's product, downloaded from the ALMA data portal into `.local/pds-70-disc/observations/`. Benisty et al. (2021, ApJL 916, L2; [arXiv:2108.07123](https://arxiv.org/abs/2108.07123)) published these observations but deposited no image: theirs is self-calibrated and combined with 2016 short-baseline data, and reaches 8.8 µJy per beam of noise where this one has 18.
- **Colour:** the colour map and scale of their Figure 1 (left panel, robust 0.5). Its colour bar was decoded from the figure's PDF in the paper's arXiv source: matplotlib's inferno, all 256 colours to 0 of 255, linear from −24.71 to 389.56 µJy per beam ([benisty-2021-figure-1-colormap.json](source/benisty-2021-figure-1-colormap.json) records how it was read). The image is the dust's own thermal glow, so it is not divided by the star.
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the image, the colour map, the conventions and the published geometry it is checked against. [`author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**Placement.** One volume unit is one astronomical unit at the star's prepared distance (112.39 pc), and the cube (±150 au) is anchored on the star's scene origin. The image is read through its own sky coordinates (ALMA's SIN projection, which [`@cssearth/fits`](../../../packages/fits/src/sky.ts) now reads, checked against Astropy on this image's own header). The star is placed at its Gaia DR3 position moved by its proper motion to the observing date; that lands 8 mas from the image's phase centre, under one pixel.

**The ring, measured on this image:**

| | measured here | Keppler et al. (2019) |
|---|---|---|
| radius | 73.5 au | 74 au |
| inclination | 50.0° | 51.7° |
| position angle of the nodes | 161° | 156.7° (160.4° from the gas) |

The author refuses a ring more than 5° or a tenth of the radius from the published one.

**Depth: a shape fitted to the image.** The drawn envelope is a disc of that geometry whose surface density follows the image's own deprojected radial profile, 0.1 of the radius thick. Projected back, it leaves a residual of 2.62 × 10⁻⁵ Jy per beam, against 5.95 × 10⁻⁵ for a spherical shell and 7.46 × 10⁻⁵ for constant depth. The west side is drawn nearer, the side Keppler et al. (2018) find nearer in scattered light; the planets' published orbits put their near halves west too.

## Evidence

Run of 2026-09-23 (this version):

- The ring rendered in the application around the planets' orbits, captured headless at 1440 × 900 once the application reported ready, with no console errors ([pds-70-disc-rendered.png](evidence/pds-70-disc-rendered.png)); the author's preview of the image as read, north up ([previews/dust.png](source/previews/dust.png)).
- [`sky-projection.oracle.test.mts`](../../../tools/oracles/fits/sky-projection.oracle.test.mts): this image's SIN header and a rotated wide SIN header against Astropy.
- `node tools/objects/circumstellar/author.mts pds-70-disc --check` reproduces every authored file.

## Known problems

- **Noisier than the published figure:** it is the pipeline image, not the paper's own self-calibrated one.
- **Planet c's own dust disc is not shown as such.** Benisty et al. detect it at 5.4 to 16 times their noise; in this image the brightest spot near it reaches 3.6 times, 16 mas from their position ([ledger](investigations.json)).
- **The ring's thickness is a convention** (0.1 of its radius); millimetre grains settle much thinner.
- **Selecting the dataset keeps the camera on the star.** The ring appears when you zoom out to a few hundred au, as the HD 181327 ring does.
- The colours are a colour map for brightness at one wavelength, not colours an eye would see.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
