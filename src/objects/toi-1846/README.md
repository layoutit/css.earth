# TOI-1846

## Sources

Its radius and temperature follow Soubkiou et al. 2025. This account was drafted from Soubkiou et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1420011162670761600, parallax 21.167 ± 0.015 mas (47.24 pc). Radius 0.397 +/- 0.011 solar radii from Soubkiou et al. 2025, the stellar radius of the default parameter set of TOI-1846 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541.3249S/abstract). Mass 0.418 +/- 0.025 solar masses from Soubkiou et al. 2025, the stellar mass of the default parameter set of TOI-1846 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541.3249S/abstract). Temperature 3,568 K from Soubkiou et al. 2025, the stellar temperature of the default parameter set of TOI-1846 b in the NASA Exoplanet Archive. log g 4.86 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1420011162670761600, through the CIE 1931 2° observer: #ffc587. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,568 K and log g 4.86 (u1 0.384, u2 0.380): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
