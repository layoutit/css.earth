# TOI-5713

## Sources

Its radius and temperature follow Ghachoui et al. 2024. This account was drafted from Ghachoui et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1560676770454324224, parallax 24.377 ± 0.016 mas (41.02 pc). Radius 0.2992 +/- 0.0073 solar radii from Ghachoui et al. 2024, the stellar radius of the default parameter set of TOI-5713 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.263G/abstract). Mass 0.2653 +/- 0.0061 solar masses from Ghachoui et al. 2024, the stellar mass of the default parameter set of TOI-5713 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.263G/abstract). Temperature 3,225 K from Ghachoui et al. 2024, the stellar temperature of the default parameter set of TOI-5713 b in the NASA Exoplanet Archive. log g 4.91 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1560676770454324224, through the CIE 1931 2° observer: #ffca81. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,225 K and log g 4.91 (u1 0.155, u2 0.472): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
