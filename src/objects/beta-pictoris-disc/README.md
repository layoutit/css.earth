# Beta Pictoris debris disc

## Sources

This package draws the edge-on disc of dust around [Beta Pictoris](../beta-pictoris/README.md) as a prepared volume attached to the star, the way [HD 181327's ring](../hd-181327-disc/README.md) is. It has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets. It has three lenses, because no one image covers the disc from where the planets orbit to its outer reaches.

- **Visible light (default), 16 to 102 au.** Hubble's STIS coronagraph image at 0.58 micrometres, combined from programmes 7125 (1997), 12551 (2012) and 12923 (2013) by Ren et al. (2023, A&A 672, A114, [arXiv:2302.04273](https://arxiv.org/abs/2302.04273)). It is deposited at CDS as [`Beta_Pic_STIS.fits`](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/672/A114) and pinned by digest in the [recipe](source/circumstellar.json). It reaches 0.8 arcseconds from the star, so it covers the orbit of planet d, 26 au out.
- **Colour, 29 to 135 au.** Hubble's ACS/HRC coronagraph through F435W, F606W and F814W on 1 October 2003, programme 9987, the run of Golimowski et al. (2006, AJ 131, 3109, [arXiv:astro-ph/0602292](https://arxiv.org/abs/astro-ph/0602292)). The starlight was removed here from the raw exposures ([below](#the-hubble-colour-lens)).
- **2.1 and 4.1 micrometres, 49 to 124 au.** MAST's level-3 coronagraph mosaics of JWST/NIRCam F210M and F410M behind MASK335R, 21 March 2025, observation c1002 of GO programme 4758 (PI Y. Zhou), the rotation-monitoring run of [Zhou et al. (2026)](https://arxiv.org/abs/2607.13133). They are pinned with their coron3 associations in [`beta-pictoris-4758.json`](../../../tools/objects/jwst/imaging/programs/beta-pictoris-4758.json).
- **Recipe.** [`source/circumstellar.json`](source/circumstellar.json) names the lenses, their inputs, the stated conventions and stretches, and the published geometry each measurement is checked against. [`author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it, and `--check` reproduces it byte for byte.

**Where the star is.** The JWST mosaics' own pointing misses the star by 57 to 85 mas. Planet b, a point 0.54 arcseconds out in both, has an orbit that reproduces GRAVITY's astrometry to 1.3 mas (see [Beta Pictoris b](../beta-pictoris-b/README.md)). So the star is placed by the planet ([`registerStarByPlanet`](../../../tools/objects/circumstellar/edge-on-disc.mts)). The STIS deposit has no sky coordinates: its ReadMe puts the star at the array's centre, Ren et al. give the plate scale, 50.72 mas, and the orientation was measured here against the registered JWST images. In the ACS images the star is where its coronagraphic PSF is most nearly symmetric under a half turn.

**The midplane, measured.** [`midplaneGeometry`](../../../tools/objects/circumstellar/edge-on-disc.mts) finds the ridge of each vertical profile along a trial direction, fits a line through the ridges and turns the direction until it settles. The author refuses a midplane more than 2° from Rebollido et al.'s (2024) 29.6° ± 1.1°.

| | STIS, visible | ACS, colour | NIRCam, 2.1 and 4.1 µm |
|---|---|---|---|
| midplane position angle | 29.6° | 29.8° | 30.7° |
| star from the midplane | 1.5 au | 1.0 au | 0.9 au |
| north-east over south-west brightness | 0.91 | 1.02 | 1.15 |

**Depth, reconstructed.** An image has no third axis. Each lens's displayed channels are solved for emission in three dimensions by the axially symmetric method of Wenger, Lorenz & Magnor (2013), in the nebula lab ([`reconstruct-circumstellar`](../../../labs/nebula/packages/lab/src/cli/commands/circumstellar/reconstruct.ts), solver in `labs/nebula/packages/reconstruction/src/methods/symmetry`). The symmetry axis is the disc's normal, tilted 1° from the sky toward the north-west: planet b's orbital inclination, 89.00° (Lacour et al. 2021), which Kraus et al. (2020) align with the disc to 3° ± 4°. Voxels at one height and one radius share an emission. Pixels with no data get no weight, and a voxel seen only through the blank inside the inner edge takes its group's emission. Each lens's `reconstruction-<lens>.json` records the channel digest it was solved from, and the author refuses a reconstruction of other channels.

| lens | reprojection error | light at the tangent point, reconstructed | same, for an extrusion |
|---|---|---|---|
| visible | 6.8% | 0.64 to 0.83 | 0.29 to 0.42 |
| colour | 8.0 to 8.4% | 0.46 to 0.58 | 0.33 to 0.47 |
| 2.1 and 4.1 µm | 8.3 to 11.8% | 0.48 to 0.79 | 0.37 to 0.46 |

The tangent share is the fraction of a midplane column's light that lies within 20 au of the radius the column projects to, measured at three distances per lens. An extrusion spreads it evenly along the grid.

**One grid.** All three lenses share a grid 270 au across, 156 cells, 1.7 au each, because every lens of one dataset bank must share a frame: switching dataset must not move or resize the object. The ACS colour image reaches farther than that grid, and is drawn only to its edge ([below](#known-problems)). A grid wide enough for it would need 4.1 au cells, and at that size the STIS lens's midplane can no longer be measured, so the wide grid was rejected.

## The Hubble colour lens

The archive's ACS/HRC products still carry the star. [`psf-subtract.mts`](../../../tools/objects/hst/psf-subtract.mts) removes it, as described in the [Hubble guide](../../../docs/hubble.md#a-coronagraphs-starlight-removed):

1. All 18 associations of programme 9987 are recalibrated from raw with calacs. The re-run of `j8qj15060` matches the archive's combined product, 72% of samples bit-identical, the largest relative difference 1.5e-5.
2. Alpha Pictoris, the reference star, is divided by the flux ratios Golimowski et al. state, 1.65, 1.75 and 1.90 in F435W, F606W and F814W, and shifted onto Beta Pic. Only the shift is fitted: 0.6 to 0.9 pixel, against the paper's 0.8.
3. Each result is drizzled north up. The two rolls are averaged on the sky, each standing alone where the occulting finger blanks the other.
4. Each filter is divided by the star's count rate in it: the paper's Vega magnitudes (F435W 4.05, F606W 3.81, F814W 3.68) with Sirianni et al.'s (2005) HRC zero points. That leaves the disc's colour against the star's. F435W is blue, F606W green, F814W red.

Nothing is drawn within 1.5 arcseconds (29 au), where Golimowski et al. find the subtraction too uncertain for photometry, and nothing beyond the grid's 135 au.

**Colour.** The visible lens is one filter in grey, in the deposit's counts per pixel per second. The colour lens and the JWST lens are each filter's contrast to the star; the JWST lens takes the star's flux from Kammerer et al. (2024, Table 2), 26.14 Jy in F210M and 8.20 Jy in F410M. No lens has a published figure to fit a stretch to, so each stretch is stated: its top is the 99.5th percentile within the midplane strip, with log strength 10. Columns fade in from one to three times their noise.

**What JWST programme 1411 adds, and why it is not drawn.** Its F182M image behind the smaller MASK210R (17 March 2023) is pinned in [`beta-pictoris-1411.json`](../../../tools/objects/jwst/imaging/programs/beta-pictoris-1411.json). MAST's automatic subtraction of it leaves speckle to about 1.5 arcseconds, and planet b stands only 2.7 times above the scatter around it. So it places neither the star nor the inner disc better than Hubble does.

## Evidence

Runs of 2026-09-22, this version:

- `node tools/objects/hst/psf-subtract.mts beta-pictoris-9987 .local/beta-pictoris-disc/hst` made the six ACS products, pinned by digest in the recipe; each has its product record beside it.
- `node tools/objects/hst/compare.mts beta-pictoris-9987 j8qj15060 …` wrote the archive comparison receipts in `tools/objects/hst/programs/`.
- `node --experimental-strip-types labs/nebula/run.mts reconstruct-circumstellar beta-pictoris-disc` solved all three lenses; the two older lenses reproduced their previous errors exactly.
- `node tools/objects/circumstellar/author.mts beta-pictoris-disc` measured all three lenses (numbers above).
- [`edge-on-disc.test.mts`](../../../tools/objects/circumstellar/edge-on-disc.test.mts): a synthetic edge-on disc's midplane is recovered from its own projection; the ridge stays on the main disc beside a tilted secondary one; a deposited array read north up and east left puts a north-east source north-east. [`psf-subtract.test.mts`](../../../tools/objects/hst/psf-subtract.test.mts): every association the subtraction names is pinned through its band on its star, and a missing or impossible flux ratio is refused.

## Known problems

- **The colour lens is cut at 135 au, and the disc goes on.** The ACS images hold it above the noise to the edge of the camera's field. Measured on the subtracted images in 20 au bins along the midplane, against a per-channel noise of 0.0026 to 0.0035: 0.44 at 120 to 140 au, 0.084 at 180 to 200, 0.026 at 240 to 260 and 0.007 at 300 to 320, the last still twice the noise ([ledger entry](investigations.json) `lens-colour-extent`). Only the part inside 135 au is drawn.
- **The colour lens is bluer than Golimowski et al. measure.** Along the midplane 40 to 100 au out, F606W/F435W is 0.94 and F814W/F435W 0.92 against the star; the paper measures the disc slightly redder than the star, near 1.07 in F606W/F435W. The light the subtraction leaves beside the disc is 16 to 19% of the midplane there, and it is bluer than the star, so it pulls the colour blue. How much of the gap it explains is not measured.
- **The paper's flux ratio leaves starlight.** Far from the disc, Beta Pic's raw halo in F435W is 0.81 of alpha Pic's where the ratio predicts 0.61, in the long and the short frames alike. The paper refined its scaling by eye and does not print the final factors, so its stated ratios are used, and about a quarter of the halo stays in the image, drawn with the disc. The ratio a free fit would choose is recorded as a check.
- **One ACS shift is not understood.** In F814W the two rolls' vertical shifts differ by 0.9 pixel; in the other filters they agree to 0.1.
- **Planets b and c orbit inside the part no image reaches.** Their orbits, 10 and 2.7 au, project within 0.51 and 0.14 arcseconds of the star, inside every coronagraph's clean region here. The disc there is real, imaged from the ground to a few au, but not drawn.
- **Which side tilts toward us is a convention** taken from forward scattering, and the tilt is 1°: an image this close to edge-on barely changes with it.
- **Near the star the STIS subtraction leaves light off the disc**, which is drawn with the disc.
- **Opacity is the renderer's convention**: the top of each stretch reaches an alpha of 0.5; the real disc blocks a fraction of a percent.

[Investigation ledger](investigations.json) · [Recipe](source/circumstellar.json) · [Inputs](source/manifest.json) · [Provenance](source/provenance.json)
