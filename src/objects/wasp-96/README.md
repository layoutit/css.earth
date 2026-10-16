# WASP-96

## Sources

Its radius and temperature follow Hellier et al. 2014. The introduction is generated from Hellier et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4990044668377961984, parallax 2.859 ± 0.015 mas (349.77 pc). Radius 1.05 +/- 0.05 solar radii from Hellier et al. 2014, the stellar radius of the default parameter set of WASP-96 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.440.1982H/abstract). Mass 1.06 +/- 0.09 solar masses from Hellier et al. 2014, the stellar mass of the default parameter set of WASP-96 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.440.1982H/abstract). Temperature 5,540 K from Hellier et al. 2014, the stellar temperature of the default parameter set of WASP-96 b in the NASA Exoplanet Archive. log g 4.42 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4990044668377961984, through the CIE 1931 2° observer: #ffede4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,540 K and log g 4.42 (u1 0.511, u2 0.226): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-96" (revision 1329658058) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
