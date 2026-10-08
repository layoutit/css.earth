# CoRoT-2

## Sources

Its radius and temperature follow Gillon et al. 2010. The introduction is generated from Gillon et al. 2010's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4287820848378092672, parallax 4.690 ± 0.014 mas (213.24 pc). Radius 0.906 +/- 0.026 solar radii from Gillon et al. 2010, the stellar radius of the default parameter set of CoRoT-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010A&A...511A...3G/abstract). Mass 0.96 +/- 0.08 solar masses from Gillon et al. 2010, the stellar mass of the default parameter set of CoRoT-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010A&A...511A...3G/abstract). Temperature 5,625 K from Gillon et al. 2010, the stellar temperature of the default parameter set of CoRoT-2 b in the NASA Exoplanet Archive. log g 4.51 from the mass and radius.

**Color.** A Planck spectrum at 5,625 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffefe5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,625 K and log g 4.51 (u1 0.493, u2 0.238): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "CoRoT-2" (revision 1374617421) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
