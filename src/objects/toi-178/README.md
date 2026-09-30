# TOI-178

## Sources

Its radius and temperature follow Leleu et al. 2024. This account was drafted from Leleu et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2318295979126499200, parallax 15.900 ± 0.031 mas (62.89 pc); its RUWE is 1.5, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.662 +/- 0.01 solar radii from Leleu et al. 2024, the stellar radius of the default parameter set of TOI-178 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.211L/abstract). Mass 0.647 +/- 0.03 solar masses from Leleu et al. 2024, the stellar mass of the default parameter set of TOI-178 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.211L/abstract). Temperature 4,316 K from Leleu et al. 2024, the stellar temperature of the default parameter set of TOI-178 b in the NASA Exoplanet Archive. log g 4.61 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2318295979126499200, through the CIE 1931 2° observer: #ffc8a5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,316 K and log g 4.61 (u1 0.752, u2 0.039): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-178" (revision 1374438915), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
