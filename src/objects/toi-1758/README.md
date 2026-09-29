# TOI-1758

## Sources

Its radius and temperature follow Crossfield et al. 2025. This account was drafted from Crossfield et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2232494455385669760, parallax 10.420 ± 0.010 mas (95.97 pc). Radius 0.81 +/- 0.05 solar radii from Crossfield et al. 2025, the stellar radius of the default parameter set of TOI-1758 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Mass 0.88 +/- 0.11 solar masses from Crossfield et al. 2025, the stellar mass of the default parameter set of TOI-1758 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Temperature 5,169 K from Crossfield et al. 2025, the stellar temperature of the default parameter set of TOI-1758 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2232494455385669760, through the CIE 1931 2° observer: #ffe6d6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,169 K and log g 4.57 (u1 0.609, u2 0.156): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
