# Kepler-94

## Sources

Its radius and temperature follow Marcy et al. 2014. The introduction is generated from Marcy et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2119602202081351168, parallax 5.248 ± 0.011 mas (190.56 pc). Radius 0.76 +/- 0.03 solar radii from Marcy et al. 2014, the stellar radius of the default parameter set of Kepler-94 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJS..210...20M/abstract). Mass 0.81 +/- 0.06 solar masses from Marcy et al. 2014, the stellar mass of the default parameter set of Kepler-94 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJS..210...20M/abstract). Temperature 4,781 K from Marcy et al. 2014, the stellar temperature of the default parameter set of Kepler-94 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2119602202081351168, through the CIE 1931 2° observer: #ffcfad. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,781 K and log g 4.58 (u1 0.718, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-94 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
