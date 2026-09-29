# TOI-6008

## Sources

Its radius and temperature follow Barkaoui et al. 2024. This account was drafted from Barkaoui et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2168280502430898944, parallax 43.440 ± 0.016 mas (23.02 pc). Radius 0.242 +/- 0.013 solar radii from Barkaoui et al. 2024, the stellar radius of the default parameter set of TOI-6008 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...687A.264B/abstract). Mass 0.23 +/- 0.011 solar masses from Barkaoui et al. 2024, the stellar mass of the default parameter set of TOI-6008 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...687A.264B/abstract). Temperature 3,075 K from Barkaoui et al. 2024, the stellar temperature of the default parameter set of TOI-6008 b in the NASA Exoplanet Archive. log g 5.03 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2168280502430898944, through the CIE 1931 2° observer: #ffcc7b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,075 K and log g 5.03 (u1 0.171, u2 0.505): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/toi-6008.json: 5.032.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
