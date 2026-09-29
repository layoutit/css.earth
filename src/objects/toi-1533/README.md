# TOI-1533

## Sources

Its radius and temperature follow Mantovan et al. 2026. This account was drafted from Mantovan et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1998672961158273024, parallax 10.003 ± 0.013 mas (99.97 pc). Radius 0.849 +/- 0.004 solar radii from Mantovan et al. 2026, the stellar radius of the default parameter set of TOI-1533 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260630799M/abstract). Mass 0.88 +/- 0.04 solar masses from Mantovan et al. 2026, the stellar mass of the default parameter set of TOI-1533 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260630799M/abstract). Temperature 5,146 K from Mantovan et al. 2026, the stellar temperature of the default parameter set of TOI-1533 b in the NASA Exoplanet Archive. log g 4.52 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1998672961158273024, through the CIE 1931 2° observer: #ffdfc9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,146 K and log g 4.52 (u1 0.615, u2 0.152): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
