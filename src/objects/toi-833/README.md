# TOI-833

## Sources

Its radius and temperature follow Giacalone et al. 2022. This account was drafted from Giacalone et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5250780970316845696, parallax 23.921 ± 0.010 mas (41.80 pc). Radius 0.6 +/- 0.02 solar radii from Giacalone et al. 2022, the stellar radius of the default parameter set of TOI-833 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Mass 0.61 +/- 0.03 solar masses from Giacalone et al. 2022, the stellar mass of the default parameter set of TOI-833 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Temperature 3,920 K from Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-833 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5250780970316845696, through the CIE 1931 2° observer: #ffbe8c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,920 K and log g 4.67 (u1 0.501, u2 0.258): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
