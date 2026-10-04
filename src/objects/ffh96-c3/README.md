# [FFH96] C3

## Sources

Kanbur et al. (2003) list its pulsation at 63.5 days. The introduction is generated from Kanbur et al. (2003), A&A 411, 361's published values; the sections below are the data's own.

**Star.** Placement: Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC4321, Cepheid = C3, names the star in SIMBAD (SName); SIMBAD holds its position and names no paper for it, SIMBAD basic row main_id = [FFH96] C3 (SIMBAD [FFH96] C3); placed by that row, not by a Gaia source, distance 15,215,772 pc from Placed in M100 as the app draws it, where the star's sight line crosses the disc's midplane: 15,215,772 pc (src/objects/m100-layers/source/recipe.json: centre 15,210,000 pc, inclination 38.5 deg, line of nodes 156.2 deg). The galaxy's distance, which places the galaxy and not a star within it: Leroy et al. (2021), PHANGS-ALMA, ApJS 257, 43, table of galaxies, row NGC4321: distance 15.21 ± 0.5 Mpc, from the compilation of Anand et al. (2021) (https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43). Radius 241.5 +/- 40.3 solar radii from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 63.53 d in Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC4321, Cepheid = C3 (log(P) 1.803); not a measurement of this star: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, 0.067 dex (https://arxiv.org/abs/2002.02186). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,720 K from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 63.53 d in Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC4321, Cepheid = C3 (log(P) 1.803); not a measurement of this star: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)); the uncertainty is the 317 K by which the two relations miss the paper's own Cepheid temperatures. No surface gravity of this star is published.

**Color.** A Planck spectrum at 4,720 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe1c5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,720 K and log g 0.65 (u1 0.706, u2 0.076): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.5% of the centre brightness from the one drawn, at log g 0.65, the gravity closest to all of them; log g 0.65 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from SIMBAD basic and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** Its radius and temperature are what Groenewegen (2020), A&A 635, A33's relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M100 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
