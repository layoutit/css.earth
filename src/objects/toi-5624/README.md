# TOI-5624

## Sources

Its radius and temperature follow Bonfanti et al. 2026. The introduction is generated from Bonfanti et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1546352569189373952, parallax 9.864 ± 0.015 mas (101.38 pc). Radius 0.82 +/- 0.005 solar radii from Bonfanti et al. 2026, the stellar radius of the default parameter set of TOI-5624 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...709A.265B/abstract). Mass 0.858 +/- 0.033 solar masses from Bonfanti et al. 2026, the stellar mass of the default parameter set of TOI-5624 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...709A.265B/abstract). Temperature 5,327 K from Bonfanti et al. 2026, the stellar temperature of the default parameter set of TOI-5624 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1546352569189373952, through the CIE 1931 2° observer: #ffe9dc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,327 K and log g 4.54 (u1 0.566, u2 0.188): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-5624 f: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-5624" (revision 1374406089) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
