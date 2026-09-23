# 51 Eridani b

51 Eridani b is a young giant planet found in 2015 with the Gemini Planet Imager (Macintosh et al. [2015](https://arxiv.org/abs/1508.03084)), whose spectrum showed methane and water. It orbits [51 Eridani](../hd-29391/README.md) about 9 au out.

## Sources

**Orbit.** Denis et al. (2026, [arXiv:2602.10260](https://arxiv.org/abs/2602.10260)), Table 2: the fit to all published relative astrometry and four VLT/HiRISE radial velocities of the planet, whose sign breaks the 180° ambiguity of ω and Ω that astrometry alone leaves (Balmer et al. 2025, Table 3). The record takes the table's chi-squared-minimum column, the single best-fitting orbit: a 8.91 au at the Gaia DR3 distance, e 0.58, i 165°, ω 84° (the planet's; stored as the star's, 264°), Ω 69° east of north, P 22.76 years, periastron τ 0.33 of a period after MJD 58849. The table's posterior medians (a 9.08 au, e 0.55, i 159.24°, ω 55.41°, Ω 58.25°) are not one orbit: seen nearly face-on, ω and Ω are uncertain by about 50°, and together the medians put the planet 92 mas from JWST's measured position. Every element is in [`hd-29391-b.json`](../../../packages/astronomy/data/bodies/hd-29391-b.json).

**Checked against JWST and HiRISE.** Of the four sign choices for ω and Ω only the recorded one reproduces both measurements ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)): the orbit puts the planet at (279, −107) mas on 17 October 2023, 11 mas from JWST's (286, −99) ± (10, 4) (Balmer et al. 2025, AJ; [arXiv:2503.13608](https://arxiv.org/abs/2503.13608), Table 2), and moving away from us relative to its star at 3.0 to 3.9 km/s on the four HiRISE nights, within twice the measured errors of +1.7 to +4.2 km/s (Denis et al. 2026, Table 1).

**Radius, temperature and mass.** 1.36 +0.07/−0.03 Jupiter radii and 800 +21.5/−55.5 K from the atmospheric model fit of Madurowicz et al. (2025, AJ; [arXiv:2510.08327](https://arxiv.org/abs/2510.08327)) to JWST/NIRSpec and ground-based spectra. The temperature is disputed: Balmer et al. (2025) find 632 ± 13 K and 1.30 ± 0.03 R_J with a radius prior from evolutionary models, and 581 ± 50 K and 1.62 ± 0.31 R_J without it. The radius is a model value; the planet is a point in every image. The mass is a model mass, 4.1 ± 0.4 Jupiter masses from Sonora Bobcat evolution (Elliott et al. 2024); the orbit gives only an upper limit, under 9.0 at 3σ (Balmer et al. 2025).

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its 800 K glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray. JWST detects the planet in only one band, F410M (Balmer et al. 2025); three measured bands are needed for a colour like HR 8799's planets have, so none is cast.

**Rotation.** None measured; Denis et al. measure a projected spin velocity, but no period or axis. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) checks the JWST position and the four HiRISE radial velocities (above); the astronomy package's 856 tests pass.

## Known problems

- The radius and mass are model values, and the temperature is disputed between the two latest analyses (above).
- The orbit is one best-fitting sample from a posterior that is wide in ω and Ω.
- No colour is measured in three bands, and our JWST reduction does not yet reproduce the paper's detection (see [51 Eridani](../hd-29391/README.md)).
- No spin is measured; the axis shown is the orbit normal.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
