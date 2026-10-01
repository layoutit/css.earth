# M33SSS J013345.82+304420.7

## Sources

The Hubble Space Telescope measured its brightness in three colours; its pulsation takes 13.1 days. Its galaxy's distance, 840 kiloparsecs, was measured from Cepheids like it. The introduction is generated from Breuval et al. (2023), ApJ 951, 118's published values; the sections below are the data's own.

**Star.** Placement: Breuval et al. (2023), ApJ 951, 118, table 9, VizieR J/ApJ/951/118/table9 row ID = 01334582+3044207 (SIMBAD M33SSS J013345.82+304420.7); placed by that row, not by a Gaia source, distance 859,985 pc from Placed in M33 as the app draws it, where the star's sight line crosses the disc's midplane: 859,985 pc (src/objects/m33/source/recipe.json: centre 859,014 pc from the Local Volume Database v1.1.1 (Pace 2025), inclination 54 deg, line of nodes 22.5 deg). The galaxy's Cepheid distance, Breuval et al. (2023), ApJ 951, 118, abstract: modulus 24.622 +/- 0.03 mag, 840 kpc; it places the galaxy, not a star within it. Radius 77.5 +/- 12.9 solar radii from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 13.12 d in Breuval et al. (2023), ApJ 951, 118, table 9 (log P 1.118); not a measurement of this star: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, 0.067 dex (https://arxiv.org/abs/2002.02186). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,230 K from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 13.12 d in Breuval et al. (2023), ApJ 951, 118, table 9 (log P 1.118); not a measurement of this star: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)); the uncertainty is the 317 K by which the two relations miss the paper's own Cepheid temperatures. No surface gravity of this star is published.

**Colour.** A Planck spectrum at 5,230 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffead8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,230 K and log g 0.9 (u1 0.565, u2 0.174): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.9% of the centre brightness from the one drawn, at log g 0.9, the gravity closest to all of them; log g 0.9 is a display choice, not a measurement.

## Evidence

Generated 2026-10-01 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR J/ApJ/951/118/table9 and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** Its radius and temperature are what Groenewegen (2020), A&A 635, A33's relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M33 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
