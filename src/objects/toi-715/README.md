# TOI-715

## Sources

Its radius and temperature follow Dransfield et al. 2024. The introduction is generated from Dransfield et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5262666416118954368, parallax 23.512 ± 0.017 mas (42.53 pc). Radius 0.24 +/- 0.012 solar radii from Dransfield et al. 2024, the stellar radius of the default parameter set of TOI-715 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.527...35D/abstract). Mass 0.225 +/- 0.012 solar masses from Dransfield et al. 2024, the stellar mass of the default parameter set of TOI-715 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.527...35D/abstract). Temperature 3,075 K from Dransfield et al. 2024, the stellar temperature of the default parameter set of TOI-715 b in the NASA Exoplanet Archive. log g 5.03 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5262666416118954368, through the CIE 1931 2° observer: #ffca7b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,075 K and log g 5.03 (u1 0.171, u2 0.505): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-715" (revision 1374442455) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
