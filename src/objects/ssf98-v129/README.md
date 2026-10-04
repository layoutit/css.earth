# [SSF98] V129

## Sources

Hoffmann et al. (2016) list its pulsation at 66.1 days. The introduction is generated from Hoffmann et al. (2016), ApJ 830, 10's published values; the sections below are the data's own.

**Star.** Placement: Hoffmann et al. (2016), ApJ 830, 10, VizieR J/ApJ/830/10/table5 row Gal = M101, ID = 277598 (SIMBAD [SSF98] V129); placed by that row, not by a Gaia source, distance 6,714,829 pc from Placed in M101 as the app draws it, where the star's sight line crosses the disc's midplane: 6,714,829 pc (src/objects/m101-layers/source/recipe.json: centre 6,714,289 pc, inclination 18 deg, line of nodes 219 deg). The galaxy's distance, which places the galaxy and not a star within it: Riess et al. (2016), ApJ 826, 56, Table 5 (Approximations for Distance Parameters), row M101: Cepheid distance modulus mu_Ceph = 29.135 +/- 0.045, d = 6.71 Mpc. (https://arxiv.org/abs/1604.01424); catalogue reference Riess2016ApJ...826...56R: 6714288.52926 pc (-137710.155706/+140593.735267); cepheids. Radius 248.5 +/- 41.5 solar radii from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 66.095 d in Hoffmann et al. (2016), ApJ 830, 10, VizieR J/ApJ/830/10/table5 Gal = M101, ID = 277598 (Per); not a measurement of this star: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, 0.067 dex (https://arxiv.org/abs/2002.02186). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,710 K from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 66.095 d in Hoffmann et al. (2016), ApJ 830, 10, VizieR J/ApJ/830/10/table5 Gal = M101, ID = 277598 (Per); not a measurement of this star: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)); the uncertainty is the 317 K by which the two relations miss the paper's own Cepheid temperatures. No surface gravity of this star is published.

**Color.** A Planck spectrum at 4,710 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,710 K and log g 0.6 (u1 0.710, u2 0.073): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.5% of the centre brightness from the one drawn, at log g 0.6, the gravity closest to all of them; log g 0.6 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR J/ApJ/830/10/table5 and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** Its radius and temperature are what Groenewegen (2020), A&A 635, A33's relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M101 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
