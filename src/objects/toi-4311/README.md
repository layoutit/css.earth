# TOI-4311

## Sources

Its radius and temperature follow Eschen et al. 2026. This account was drafted from Eschen et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5064693746900436736, parallax 7.413 ± 0.028 mas (134.89 pc). Radius 0.8441 +/- 0.0062 solar radii from Eschen et al. 2026, the stellar radius of the default parameter set of TOI-4311 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag952E/abstract). Mass 0.816 +/- 0.047 solar masses from Eschen et al. 2026, the stellar mass of the default parameter set of TOI-4311 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag952E/abstract). Temperature 5,063 K from Eschen et al. 2026, the stellar temperature of the default parameter set of TOI-4311 c in the NASA Exoplanet Archive. log g 4.5 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5064693746900436736, through the CIE 1931 2° observer: #ffe4d4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,063 K and log g 4.5 (u1 0.639, u2 0.134): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-4311 b: Eschen et al. 2026's mass 0.01415858 Jupiter masses in 0.12275871 Jupiter radii is 9.5 g/cm^3, outside what the records accept.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
