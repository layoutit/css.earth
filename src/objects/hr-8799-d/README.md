# HR 8799 d

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HR 8799 d is one of the three planets Marois et al. ([2008](https://arxiv.org/abs/0811.2606)) imaged with Keck and Gemini. It orbits [HR 8799](../hr-8799/README.md) about 27 au out.

## Sources

**Orbit.** Zurlo et al. (2022, A&A 666, A133; [arXiv:2207.10684](https://arxiv.org/abs/2207.10684)), Table 3 model 1: the coplanar four-planet fit to over 20 years of astrometry, at stellar mass 1.47 solar masses and parallax 24.525662 mas, osculating elements at epoch 1998.83. Its semi-major axis, 648.75 mas, is kept as an angle and placed at the Gaia DR3 distance: 26.52 au. Eccentricity 0.1146, inclination 26.87° and ascending node 62.19° east of north, shared by all four planets. The paper prints no period; it is derived from Kepler's third law with the fitted masses, about 112 years. Every element is in [`hr-8799-d.json`](../../../packages/astronomy/data/bodies/hr-8799-d.json).

**Checked against later astrometry.** On 5 November 2023 JWST measured the planet's offset from the star (Balmer et al. 2025, AJ; [arXiv:2503.13608](https://arxiv.org/abs/2503.13608), Table 2), after the fit was made. The recorded orbit puts the planet 12.3 mas from that position ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)). It misses in declination by 12 mas, 2.5 of the paper's 5 mas sigmas, which are the scatter between filters.

**Radius, temperature and mass.** Nasedkin et al. (2024, A&A 687, A298; [arXiv:2404.03776](https://arxiv.org/abs/2404.03776)), Table 3: the Bayesian model average of retrievals on GRAVITY and archival spectra, radius 1.26 +0.06/−0.08 Jupiter radii and effective temperature 1,179 +31/−28 K. The radius is the one a model atmosphere needs for the measured spectrum, constrained by the dynamical mass as a prior; the planet itself is a point in every image. Mass 9.19 Jupiter masses, dynamical (Zurlo et al. 2022, Table 3 model 1).

**Its own light.** The planet is drawn self-luminous, with no light from its star: Nasedkin et al. (2024) describe "self-luminous atmospheres", and Marois et al. ([2010](https://arxiv.org/abs/1011.4918)) say the planets are "still hot and bright as they radiate away gravitational energy". The build is the emissive one of the other imaged planets ([Beta Pictoris c](../beta-pictoris-c/README.md)): the sphere's silhouette is the limb, and both plates around it are transparent.

**NIRCam color dataset.** The planet's flux densities in JWST/NIRCam F460M, F430M and F410M, 319.2, 354.4 and 410.5 µJy (Balmer et al. 2025, Table 2), drive red, green and blue. Balmer et al. detect all four planets in these three filters (section III.3), and the longest wavelength is red. The four planets share one range, from zero to the largest of their twelve values, planet d itself in F410M (410.5 µJy), so their band ratios and their brightness against each other survive ([color preparation](../../../docs/color-preparation.md)). The result, #e4efff, is infrared false color, not what an eye would see, and one color for the whole disc ([photometry record](source/photometry/jwst-nircam-band-color.json)).

**Limb.** The disc is dimmed toward the limb by the quadratic law fitted to the JWST/NIRCam F430M intensity PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70) computes from Sonora Diamondback cloudy (Morley et al. 2024, ApJ 975, 59; [M/H] +0.5, f_sed 1) model atmospheres at 1,200 K and log g 3.5, read between the models t1100g31f1_m+0.5_co1.0, t1100g100f1_m+0.5_co1.0, t1200g31f1_m+0.5_co1.0, t1200g100f1_m+0.5_co1.0 (u1 0.248, u2 0.132; the law fits each model's eight angles within 0.16% of the centre): a cloudy model, the one Nasedkin et al. (2024), A&A 687, A298 fit to this planet, because no table reaches a planet this cold and nobody has resolved its disc ([nodes](source/photometry/picaso-diamondback-f430m-quadratic.tsv)). The temperature and gravity are that fit's (Table 9 (grid-fit chi-squared results), HR 8799 d, Diamondback: chi-squared 1336, Teff 1200, log g 3.5, [M/H] 0.5, f_sed 1.0, C/O 0.458, radius 1.12; the single best-fit model of that grid; [record](source/photometry/atmosphere-fit.json)), not the 1,179 K of its measurements record.

**Rotation.** None measured in the papers this package cites; the display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet 12.3 mas from JWST's measured position (above); the four planets miss by 11 mas RMS, under 2% of their separations.
- [`disc-band-color.test.mts`](../../../packages/bake/src/objects/layers/observation/disc-band-color.test.mts) (now [`packages/bake/src/objects/layers/observation/disc-band-color.test.mts`](../../../packages/bake/src/objects/layers/observation/disc-band-color.test.mts)) turns the photometry records into the four colors and checks that they share one range.
- [`new-hosted-planet.test.mts`](../../../packages/telescope-cli/src/new-object/new-hosted-planet.test.mts) checks that the self-luminous scaffold reproduces Beta Pictoris c's emissive build.

## Known problems

- The radius is a model value; no disc of the planet is measured.
- The color is infrared false color of the whole disc. Another choice of three bands from Balmer et al.'s Table 2 would give another hue; these three are the ones in which the paper detects all four planets.
- The period is derived, not printed by the paper.
- Orbit elements are posterior medians of a coplanar fit, which reproduce the data but are not a single self-consistent sample.
- No spin is measured; the axis shown is the orbit normal.
- **Model limb.** The limb darkening is computed from the cloudy model a paper fitted to the planet, in the middle band of its color, not a measurement of this planet; another model grid would give another law.
- The limb law's model grid is not the best-fitting one: Nasedkin et al. (2024, Table 8) find that Exo-REM and ATMO fit these spectra better than Diamondback, which is used because its structures and cloud properties are public.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
