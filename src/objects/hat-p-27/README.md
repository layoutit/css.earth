# HAT-P-27

## Sources

Its radius and temperature follow TICv8. The introduction is generated from TICv8's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1159336403336463872, parallax 4.953 ± 0.017 mas (201.91 pc). Radius 0.864673 +/- 0.049715 solar radii from TICv8, the stellar radius of the default parameter set of HAT-P-27 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Mass 0.916 +/- 0.121408 solar masses from TICv8, the stellar mass of the default parameter set of HAT-P-27 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Temperature 5,316 K from TICv8, the stellar temperature of the default parameter set of HAT-P-27 b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Color.** A Planck spectrum at 5,316 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffebdb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,316 K and log g 4.53 (u1 0.569, u2 0.186): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-27" (revision 1374863887) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
