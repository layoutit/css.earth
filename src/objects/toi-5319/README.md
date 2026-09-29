# TOI-5319

## Sources

Its radius and temperature follow Peláez-Torres et al. 2024. This account was drafted from Peláez-Torres et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 102461087706561024, parallax 16.450 ± 0.017 mas (60.79 pc). Radius 0.485 +/- 0.067 solar radii from Peláez-Torres et al. 2024, the stellar radius of the default parameter set of TOI-5319 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A..62P/abstract). Mass 0.5 +/- 0.096 solar masses from Peláez-Torres et al. 2024, the stellar mass of the default parameter set of TOI-5319 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A..62P/abstract). Temperature 3,580 K from Peláez-Torres et al. 2024, the stellar temperature of the default parameter set of TOI-5319 b in the NASA Exoplanet Archive. log g 4.77 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 102461087706561024, through the CIE 1931 2° observer: #ffc889. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,580 K and log g 4.77 (u1 0.397, u2 0.369): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
