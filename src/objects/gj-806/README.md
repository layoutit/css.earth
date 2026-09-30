# GJ 806

## Sources

Its radius and temperature follow Palle et al. 2023. It is also HIP 102401. This account was drafted from Palle et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2070115588901082368, parallax 82.890 ± 0.017 mas (12.06 pc). Radius 0.4144 +/- 0.0038 solar radii from Palle et al. 2023, the stellar radius of the default parameter set of GJ 806 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...678A..80P/abstract). Mass 0.413 +/- 0.011 solar masses from Palle et al. 2023, the stellar mass of the default parameter set of GJ 806 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...678A..80P/abstract). Temperature 3,600 K from Palle et al. 2023, the stellar temperature of the default parameter set of GJ 806 b in the NASA Exoplanet Archive. log g 4.82 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2070115588901082368, through the CIE 1931 2° observer: #ffc286. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,600 K and log g 4.82 (u1 0.387, u2 0.374): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** GJ 806 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
