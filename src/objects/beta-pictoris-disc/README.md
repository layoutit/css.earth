# Beta Pictoris debris disc

This package draws the edge-on disc of dust around [Beta Pictoris](../beta-pictoris/README.md) as a prepared volume
attached to the star, the way [HD 181327's ring](../hd-181327-disc/README.md) is. It shares the star's frame and is
listed among the star's datasets. It has three datasets, because no one image covers the disc from where the planets
orbit to its outer reaches.

## Sources

- **Visible light (default), 16 to 102 au.** Hubble's STIS coronagraph image at 0.58 micrometres, combined from
  programmes 7125 (1997), 12551 (2012) and 12923 (2013) by Ren et al. (2023, A&A 672, A114,
  [arXiv:2302.04273](https://arxiv.org/abs/2302.04273)). It is deposited at CDS as
  [`Beta_Pic_STIS.fits`](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/672/A114). It reaches 0.8 arcseconds from the
  star, covering the orbit of planet d, 26 au out.
- **Color, 29 to 135 au.** Hubble's ACS/HRC coronagraph through F435W, F606W and F814W on 1 October 2003, programme
  9987, the run of Golimowski et al. (2006, AJ 131, 3109, [arXiv:astro-ph/0602292](https://arxiv.org/abs/astro-ph/0602292)).
  The starlight was removed here from the raw exposures ([below](#the-hubble-color-dataset)).
- **2.1 and 4.1 micrometres, 49 to 124 au.** MAST's level-3 coronagraph mosaics of JWST/NIRCam F210M and F410M behind
  MASK335R, 21 March 2025, GO programme 4758 (PI Y. Zhou), the run of [Zhou et al. (2026)](https://arxiv.org/abs/2607.13133).
  They are listed in [`beta-pictoris-4758.json`](../../../packages/telescope-cli/src/archives/jwst/imaging/programs/beta-pictoris-4758.json).
- **Recipe.** [`source/circumstellar.json`](source/circumstellar.json) names the datasets, inputs, conventions,
  stretches and the published geometry each measurement is checked against.
  [`author.mts`](../../../packages/telescope-cli/authoring/circumstellar/author.mts) writes everything else in `source/`
  from it, and `--check` reproduces it byte for byte.

## Processing

**Where the star is.** The JWST mosaics' own pointing misses the star by 57 to 85 mas. Planet b's orbit reproduces
GRAVITY's astrometry to 1.3 mas (see [Beta Pictoris b](../beta-pictoris-b/README.md)), so the star is placed by the
planet ([`registerStarByPlanet`](../../../packages/telescope-cli/authoring/circumstellar/edge-on-disc.mts)). The STIS
star sits at the array's centre, and the ACS star where its coronagraphic PSF is most nearly symmetric under a half
turn.

**The midplane.** [`midplaneGeometry`](../../../packages/telescope-cli/authoring/circumstellar/edge-on-disc.mts) fits a
line through the ridge of each vertical profile. The author refuses a midplane more than 2° from Rebollido et al.'s
(2024) 29.6° ± 1.1°.

**Depth.** An image has no third axis. Each dataset is solved for emission in three dimensions by the axially symmetric
method of Wenger, Lorenz & Magnor (2013), in the nebula lab
([`reconstruct-circumstellar`](../../../labs/nebula/packages/lab/src/cli/commands/circumstellar/reconstruct.ts)). The
symmetry axis is the disc's normal, tilted 1° from the sky: planet b's orbital inclination, 89.00° (Lacour et al.
2021), which Kraus et al. (2020) align with the disc to 3° ± 4°.

**One grid.** All three datasets share a grid 270 au across, 156 cells of 1.7 au, so switching dataset does not move
or resize the object.

**Stretch.** The visible dataset is one filter in gray, in counts per pixel per second. The color and JWST datasets
are each filter's contrast to the star; the JWST star fluxes are Kammerer et al.'s (2024, Table 2) 26.14 Jy in F210M
and 8.20 Jy in F410M. No published figure fixes a stretch, so each is stated: its top is the 99.5th percentile in the
midplane strip, with log strength 10.

## The Hubble color dataset

The archive's ACS/HRC products still carry the star.
[`psf-subtract.mts`](../../../packages/telescope-cli/src/archives/hst/psf-subtract.mts) removes it, as described in
the [Hubble guide](../../../docs/hubble.md#a-coronagraphs-starlight-removed):

1. All 18 associations of programme 9987 are recalibrated from raw with calacs.
2. Alpha Pictoris, the reference star, is divided by Golimowski et al.'s flux ratios, 1.65, 1.75 and 1.90 in F435W,
   F606W and F814W, and shifted onto Beta Pic. Only the shift is fitted: 0.6 to 0.9 pixel, against the paper's 0.8.
3. Each result is drizzled north up, and the two rolls are averaged on the sky.
4. Each filter is divided by the star's count rate: the paper's Vega magnitudes (F435W 4.05, F606W 3.81, F814W 3.68)
   with Sirianni et al.'s (2005) HRC zero points. F435W is blue, F606W green, F814W red.

Nothing is drawn within 1.5 arcseconds (29 au), where Golimowski et al. find the subtraction too uncertain.

## Evidence

| | STIS, visible | ACS, color | NIRCam, 2.1 and 4.1 µm |
|---|---|---|---|
| midplane position angle | 29.6° | 29.8° | 30.7° |
| star from the midplane | 1.5 au | 1.0 au | 0.9 au |
| north-east over south-west brightness | 0.91 | 1.02 | 1.15 |

| dataset | reprojection error | light at the tangent point, reconstructed | same, for an extrusion |
|---|---|---|---|
| visible | 6.8% | 0.64 to 0.83 | 0.29 to 0.42 |
| color | 8.0 to 8.4% | 0.46 to 0.58 | 0.33 to 0.47 |
| 2.1 and 4.1 µm | 8.3 to 11.8% | 0.48 to 0.79 | 0.37 to 0.46 |

The tangent share is the fraction of a midplane column's light within 20 au of the radius the column projects to. An
extrusion spreads it evenly along the grid. The recalibrated `j8qj15060` matches the archive's combined product to a
relative difference of 1.5e-5.

## Known problems

- **The color dataset is cut at 135 au, and the disc goes on.** Against a per-channel noise of 0.0026 to 0.0035, the
  midplane measures 0.44 at 120 to 140 au and 0.007 at 300 to 320, still twice the noise
  ([ledger entry](investigations.json) `dataset-color-extent`).
- **The color dataset is bluer than Golimowski et al. measure.** Along the midplane 40 to 100 au out, F606W/F435W is
  0.94 and F814W/F435W 0.92 against the star; the paper measures near 1.07 in F606W/F435W. Leftover light beside the
  disc, 16 to 19% of the midplane and bluer than the star, pulls the color blue. How much of the gap it explains is
  not measured.
- **The paper's flux ratio leaves starlight.** Far from the disc, Beta Pic's raw F435W halo is 0.81 of alpha Pic's
  where the ratio predicts 0.61. The paper does not print its final factors, so about a quarter of the halo stays in
  the image, drawn with the disc.
- **One ACS shift is not understood.** In F814W the two rolls' vertical shifts differ by 0.9 pixel.
- **Planets b and c orbit inside the part no image reaches.** Their orbits, 10 and 2.7 au, project within 0.51 and
  0.14 arcseconds of the star. The disc there is real but not drawn.
- **Which side tilts toward us is a convention** taken from forward scattering. At 1° it barely changes the image.
- **Near the star the STIS subtraction leaves light off the disc**, which is drawn with the disc.
- **Opacity is the renderer's convention**: the top of each stretch reaches an alpha of 0.5; the real disc blocks a
  fraction of a percent.

[Investigation ledger](investigations.json) · [Recipe](source/circumstellar.json) · [Inputs](source/manifest.json) · [Provenance](source/provenance.json)
