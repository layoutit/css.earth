# TOI-1416

## Sources

Its radius and temperature follow Deeg et al. 2023. It is also HIP 70705. This account was drafted from Deeg et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1491634483976350720, parallax 18.167 ± 0.013 mas (55.04 pc). Radius 0.793 +/- 0.036 solar radii from Deeg et al. 2023, the stellar radius of the default parameter set of TOI-1416 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..12D/abstract). Mass 0.798 +/- 0.035 solar masses from Deeg et al. 2023, the stellar mass of the default parameter set of TOI-1416 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..12D/abstract). Temperature 4,884 K from Deeg et al. 2023, the stellar temperature of the default parameter set of TOI-1416 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1491634483976350720, through the CIE 1931 2° observer: #ffdfcb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,884 K and log g 4.54 (u1 0.689, u2 0.093): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
