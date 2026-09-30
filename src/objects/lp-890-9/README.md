# LP 890-9

## Sources

Its radius and temperature follow Delrez et al. 2022. This account was drafted from Delrez et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4886243456388510720, parallax 30.933 ± 0.042 mas (32.33 pc). Radius 0.1556 +/- 0.0086 solar radii from Delrez et al. 2022, the stellar radius of the default parameter set of LP 890-9 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...667A..59D/abstract). Mass 0.118 +/- 0.002 solar masses from Delrez et al. 2022, the stellar mass of the default parameter set of LP 890-9 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...667A..59D/abstract). Temperature 2,850 K from Delrez et al. 2022, the stellar temperature of the default parameter set of LP 890-9 b in the NASA Exoplanet Archive. log g 5.13 from the mass and radius.

**Colour.** A Planck spectrum at 2,850 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffb263. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 2,850 K and log g 5.13 (u1 0.229, u2 0.545): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "LP 890-9" (revision 1374442800), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
