# HR 8799 e

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HR 8799 e is the fourth planet, found by Marois et al. ([2010](https://arxiv.org/abs/1011.4918)) inside the orbits of the other three. It orbits [HR 8799](../hr-8799/README.md) about 16 au out.

## Sources

**Orbit.** Zurlo et al. (2022, A&A 666, A133; [arXiv:2207.10684](https://arxiv.org/abs/2207.10684)), Table 3 model 1: the coplanar four-planet fit to over 20 years of astrometry, at stellar mass 1.47 solar masses and parallax 24.525662 mas, osculating elements at epoch 1998.83. Its semi-major axis, 394.96 mas, is kept as an angle and placed at the Gaia DR3 distance: 16.15 au. Eccentricity 0.1477, inclination 26.87° and ascending node 62.19° east of north, shared by all four planets. GRAVITY Collaboration (2019, A&A 623, L11) find that their astrometry of e disfavours perfectly coplanar stable orbits; the coplanar fit used here is the later one of Zurlo et al., who fitted "all of the astrometric data available in the literature" (abstract). The paper prints no period; it is derived from Kepler's third law with the fitted masses, about 53 years. Every element is in [`hr-8799-e.json`](../../../packages/astronomy/data/bodies/hr-8799-e.json).

**Checked against later astrometry.** On 5 November 2023 JWST measured the planet's offset from the star (Balmer et al. 2025, AJ; [arXiv:2503.13608](https://arxiv.org/abs/2503.13608), Table 2), after the fit was made. The recorded orbit puts the planet 4.8 mas from that position ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)).

**Radius, temperature and mass.** Nasedkin et al. (2024, A&A 687, A298; [arXiv:2404.03776](https://arxiv.org/abs/2404.03776)), Table 4: the Bayesian model average of retrievals on GRAVITY and archival spectra, radius 1.12 ± 0.05 Jupiter radii and effective temperature 1,161 +33/−34 K. The radius is the one a model atmosphere needs for the measured spectrum, constrained by the dynamical mass as a prior; the planet itself is a point in every image. Mass 7.41 Jupiter masses, dynamical (Zurlo et al. 2022, Table 3 model 1).

**Its own light.** The planet is drawn self-luminous, with no light from its star: Nasedkin et al. (2024) describe "self-luminous atmospheres", and Marois et al. ([2010](https://arxiv.org/abs/1011.4918)) say the planets are "still hot and bright as they radiate away gravitational energy". The build is the emissive one of the other imaged planets ([Beta Pictoris c](../beta-pictoris-c/README.md)): the sphere's silhouette is the limb, and both plates around it are transparent.

**NIRCam colour lens.** The planet's flux densities in JWST/NIRCam F460M, F430M and F410M, 159.7, 156.3 and 256.6 µJy (Balmer et al. 2025, Table 2), drive red, green and blue. Balmer et al. detect all four planets in these three filters (section III.3), and the longest wavelength is red. The four planets share one range, from zero to the largest of their twelve values, planet d in F410M (410.5 µJy), so their band ratios and their brightness against each other survive ([colour preparation](../../../docs/color-preparation.md)). The result, #a8a6cf, is infrared false colour, not what an eye would see, and one colour for the whole disc ([photometry record](source/photometry/jwst-nircam-band-color.json)).

**Rotation.** None measured in the papers this package cites; the display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet 4.8 mas from JWST's measured position (above); the four planets miss by 11 mas RMS, under 2% of their separations.
- [`disc-band-color.test.mts`](../../../tools/objects/observation/disc-band-color.test.mts) turns the photometry records into the four colours and checks that they share one range.
- [`new-hosted-planet.test.mts`](../../../tools/objects/new-hosted-planet.test.mts) checks that the self-luminous scaffold reproduces Beta Pictoris c's emissive build.

## Known problems

- The radius is a model value; no disc of the planet is measured.
- The colour is infrared false colour of the whole disc. Another choice of three bands from Balmer et al.'s Table 2 would give another hue; these three are the ones in which the paper detects all four planets.
- The period is derived, not printed by the paper.
- Orbit elements are posterior medians of a coplanar fit, which reproduce the data but are not a single self-consistent sample.
- No spin is measured; the axis shown is the orbit normal.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
