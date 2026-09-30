# K2-233

## Sources

Its radius and temperature follow Barragán et al. 2023. This account was drafted from Barragán et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6253186686054822784, parallax 14.772 ± 0.019 mas (67.70 pc). Radius 0.71 +/- 0.01 solar radii from Barragán et al. 2023, the stellar radius of the default parameter set of K2-233 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.522.3458B/abstract). Mass 0.79 +/- 0.01 solar masses from Barragán et al. 2023, the stellar mass of the default parameter set of K2-233 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.522.3458B/abstract). Temperature 4,796 K from Barragán et al. 2023, the stellar temperature of the default parameter set of K2-233 b in the NASA Exoplanet Archive. log g 4.63 from the mass and radius.

**Colour.** A Planck spectrum at 4,796 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,796 K and log g 4.63 (u1 0.713, u2 0.072): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** K2-233 c: Barragán et al. 2023's mass 0.01447322 Jupiter masses in 0.11348043 Jupiter radii is 12.3 g/cm^3, outside what the records accept.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
