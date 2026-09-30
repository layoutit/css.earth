# Kepler-10

## Sources

Its radius and temperature follow Dumusque et al. 2014. The introduction is generated from Dumusque et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132155017099178624, parallax 5.370 ± 0.010 mas (186.23 pc). Radius 1.065 +/- 0.009 solar radii from Dumusque et al. 2014, the stellar radius of the default parameter set of Kepler-10 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJ...789..154D/abstract). Mass 0.91 +/- 0.021 solar masses from Dumusque et al. 2014, the stellar mass of the default parameter set of Kepler-10 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJ...789..154D/abstract). Temperature 5,708 K from Dumusque et al. 2014, the stellar temperature of the default parameter set of Kepler-10 b in the NASA Exoplanet Archive. log g 4.34 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2132155017099178624, through the CIE 1931 2° observer: #fff2ee. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,708 K and log g 4.34 (u1 0.472, u2 0.252): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-10 d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-10" (revision 1374405025) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
