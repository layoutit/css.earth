# TOI-4184

## Sources

Its radius and temperature follow Barkaoui et al. 2023. This account was drafted from Barkaoui et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4620574887039870720, parallax 14.451 ± 0.027 mas (69.20 pc). Radius 0.2347 +/- 0.015 solar radii from Barkaoui et al. 2023, the stellar radius of the default parameter set of TOI-4184 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..38B/abstract). Mass 0.2109 +/- 0.029 solar masses from Barkaoui et al. 2023, the stellar mass of the default parameter set of TOI-4184 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..38B/abstract). Temperature 3,238 K from Barkaoui et al. 2023, the stellar temperature of the default parameter set of TOI-4184 b in the NASA Exoplanet Archive. log g 5.02 from the mass and radius.

**Colour.** A Planck spectrum at 3,238 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbf7c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,238 K and log g 5.02 (u1 0.153, u2 0.472): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
