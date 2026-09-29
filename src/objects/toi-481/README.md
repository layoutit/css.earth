# TOI-481

## Sources

Its radius and temperature follow Brahm et al. 2020. This account was drafted from Brahm et al. 2020's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5486322710592888064, parallax 5.629 ± 0.012 mas (177.65 pc). Radius 1.66 +/- 0.02 solar radii from Brahm et al. 2020, the stellar radius of the default parameter set of TOI-481 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..235B/abstract). Mass 1.14 +/- 0.02 solar masses from Brahm et al. 2020, the stellar mass of the default parameter set of TOI-481 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..235B/abstract). Temperature 5,735 K from Brahm et al. 2020, the stellar temperature of the default parameter set of TOI-481 b in the NASA Exoplanet Archive. log g 4.05 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5486322710592888064, through the CIE 1931 2° observer: #fff1eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,735 K and log g 4.05 (u1 0.462, u2 0.259): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
