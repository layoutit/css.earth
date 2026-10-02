# Kepler-411

## Sources

Its radius follows Sun et al. 2019, and its temperature TICv8. The introduction is generated from Sun et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132768956905956352, parallax 6.531 ± 0.008 mas (153.11 pc). Radius 0.82 +/- 0.018 solar radii from Sun et al. 2019, the stellar radius of the default parameter set of Kepler-411 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...624A..15S/abstract). Mass 0.87 +/- 0.039 solar masses from Sun et al. 2019, the stellar mass of the default parameter set of Kepler-411 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...624A..15S/abstract). Temperature 4,837 K from TICv8, the stellar temperature of Kepler-411 c's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.55 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2132768956905956352, through the CIE 1931 2° observer: #ffd7bc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,837 K and log g 4.55 (u1 0.702, u2 0.082): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-411 b: Sun et al. 2019's mass 0.0805462 Jupiter masses in 0.21420287 Jupiter radii is 10.2 g/cm^3, outside what the records accept.
- **Not shown.** Kepler-411 e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-411" (revision 1373917633) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
