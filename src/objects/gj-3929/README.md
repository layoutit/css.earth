# GJ 3929

## Sources

Its radius and temperature follow Beard et al. 2022. The introduction is generated from Beard et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1372215976327300480, parallax 63.173 ± 0.021 mas (15.83 pc). Radius 0.32 +/- 0.01 solar radii from Beard et al. 2022, the stellar radius of the default parameter set of GJ 3929 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022ApJ...936...55B/abstract). Mass 0.313 +/- 0.027 solar masses from Beard et al. 2022, the stellar mass of the default parameter set of GJ 3929 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022ApJ...936...55B/abstract). Temperature 3,384 K from Beard et al. 2022, the stellar temperature of the default parameter set of GJ 3929 b in the NASA Exoplanet Archive. log g 4.92 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1372215976327300480, through the CIE 1931 2° observer: #ffc983. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,384 K and log g 4.92 (u1 0.159, u2 0.447): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** GJ 3929 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 3929" (revision 1368614101) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
