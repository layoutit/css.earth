# TOI-1732

## Sources

Its radius and temperature follow Lafarga et al. 2026. This account was drafted from Lafarga et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 983858058396166016, parallax 13.343 ± 0.017 mas (74.95 pc). Radius 0.632571 solar radii from Lafarga et al. 2026, the stellar radius of the default parameter set of TOI-1732 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag512L/abstract). Mass 0.614 +/- 0.02 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 470987100 (VizieR IV/39/tic82); no NASA Exoplanet Archive row gives one, nor does Gaia DR3 FLAME (https://doi.org/10.3847/1538-3881/ab3467). Temperature 4,201.93 K from Lafarga et al. 2026, the stellar temperature of the default parameter set of TOI-1732 b in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 983858058396166016, through the CIE 1931 2° observer: #ffbe8b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,201.93 K and log g 4.62 (u1 0.706, u2 0.078): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
