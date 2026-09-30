# TOI-1472

## Sources

Its radius and temperature follow Carleo et al. 2026. This account was drafted from Carleo et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 402396521052843264, parallax 8.196 ± 0.020 mas (122.01 pc). Radius 0.84 +/- 0.02 solar radii from Carleo et al. 2026, the stellar radius of the default parameter set of TOI-1472 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549f1958C/abstract). Mass 0.87 +/- 0.06 solar masses from Carleo et al. 2026, the stellar mass of the default parameter set of TOI-1472 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549f1958C/abstract). Temperature 5,100 K from Carleo et al. 2026, the stellar temperature of the default parameter set of TOI-1472 b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 402396521052843264, through the CIE 1931 2° observer: #ffe1cc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,100 K and log g 4.53 (u1 0.629, u2 0.142): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
