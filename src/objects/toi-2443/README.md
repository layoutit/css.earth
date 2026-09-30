# TOI-2443

## Sources

Its radius and temperature follow Naponiello et al. 2025. It is also HR 9602, HIP 12493. This account was drafted from Naponiello et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2501948402746099456, parallax 41.822 ± 0.021 mas (23.91 pc). Radius 0.631 +/- 0.014 solar radii from Naponiello et al. 2025, the stellar radius of the default parameter set of TOI-2443 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A...7N/abstract). Mass 0.642 +/- 0.026 solar masses from Naponiello et al. 2025, the stellar mass of the default parameter set of TOI-2443 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A...7N/abstract). Temperature 4,375 K from Naponiello et al. 2025, the stellar temperature of the default parameter set of TOI-2443 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2501948402746099456, through the CIE 1931 2° observer: #ffc8a7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: HR 9602 is not in the catalogue; kiehling: HR 9602 is not among its 60 stars; kharitonov: HR 9602 is not in the catalogue; burnashev: BS 9602 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,375 K and log g 4.65 (u1 0.751, u2 0.039): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
