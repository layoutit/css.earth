# TOI-1431

## Sources

Its radius and temperature follow Addison et al. 2021. It is also HD 201033, HIP 104051. This account was drafted from Addison et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2188906825165621120, parallax 6.685 ± 0.019 mas (149.59 pc). Radius 1.92 +/- 0.07 solar radii from Addison et al. 2021, the stellar radius of the default parameter set of TOI-1431 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..292A/abstract). Mass 1.9 +/- 0.1 solar masses from Addison et al. 2021, the stellar mass of the default parameter set of TOI-1431 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..292A/abstract). Temperature 7,690 K from Addison et al. 2021, the stellar temperature of the default parameter set of TOI-1431 b in the NASA Exoplanet Archive. log g 4.15 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2188906825165621120, through the CIE 1931 2° observer: #d2dbff. Routes tried in order: stis-ngsl: HD 201033 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,690 K and log g 4.15 (u1 0.283, u2 0.342): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-1431 b" (revision 1366872522), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
