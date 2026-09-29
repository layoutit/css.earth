# TOI-1634

## Sources

Its radius and temperature follow Cloutier et al. 2021. This account was drafted from Cloutier et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 223158499179138432, parallax 28.512 ± 0.018 mas (35.07 pc). Radius 0.45 +/- 0.013 solar radii from Cloutier et al. 2021, the stellar radius of the default parameter set of TOI-1634 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162...79C/abstract). Mass 0.502 +/- 0.014 solar masses from Cloutier et al. 2021, the stellar mass of the default parameter set of TOI-1634 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162...79C/abstract). Temperature 3,550 K from Cloutier et al. 2021, the stellar temperature of the default parameter set of TOI-1634 b in the NASA Exoplanet Archive. log g 4.83 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 223158499179138432, through the CIE 1931 2° observer: #ffc98a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,550 K and log g 4.83 (u1 0.390, u2 0.376): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1634 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
