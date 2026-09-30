# TOI-277

## Sources

Its radius and temperature follow Magliano et al. 2023. This account was drafted from Magliano et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2353440974955205632, parallax 15.406 ± 0.019 mas (64.91 pc). Radius 0.362 +/- 0.008 solar radii from Magliano et al. 2023, the stellar radius of the default parameter set of TOI-277 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.1562M/abstract). Mass 0.16 +/- 0.01 solar masses from Magliano et al. 2023, the stellar mass of the default parameter set of TOI-277 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.1562M/abstract). Temperature 4,031 K from Magliano et al. 2023, the stellar temperature of the default parameter set of TOI-277 b in the NASA Exoplanet Archive. log g 4.52 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2353440974955205632, through the CIE 1931 2° observer: #ffc186. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,031 K and log g 4.52 (u1 0.627, u2 0.149): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
