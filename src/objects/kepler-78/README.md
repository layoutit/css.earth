# Kepler-78

## Sources

Its radius and temperature follow Bonomo et al. 2023. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2078373642776670080, parallax 8.008 ± 0.010 mas (124.87 pc). Radius 0.7475 +/- 0.0077 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-78 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.779 +/- 0.032 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-78 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 5,058 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-78 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2078373642776670080, through the CIE 1931 2° observer: #ffe1cc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,058 K and log g 4.58 (u1 0.641, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-78" (revision 1370781331) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
