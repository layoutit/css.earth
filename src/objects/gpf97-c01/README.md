# [GPF97] c01

## Sources

Kanbur et al. (2003) list its pulsation at 43.0 days. The introduction is generated from Kanbur et al. (2003), A&A 411, 361's published values; the sections below are the data's own.

**Star.** Placement: Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC3351, Cepheid = C1, names the star in SIMBAD (SName); SIMBAD holds its position and names no paper for it, SIMBAD basic row main_id = [GPF97] c01 (SIMBAD [GPF97] c01); placed by that row, not by a Gaia source, distance 9,951,724 pc from Placed in M95 as the app draws it, where the star's sight line crosses the disc's midplane: 9,951,724 pc (src/objects/m95-layers/source/recipe.json: centre 9,954,054 pc, inclination 41 deg, line of nodes 192 deg). The galaxy's distance, which places the galaxy and not a star within it: Tully2009AJ....138..323T: The Extragalactic Distance Database (https://ui.adsabs.harvard.edu/abs/2009AJ....138..323T); catalogue reference Tully2009AJ....138..323T: 9954054.17352 pc (-136574.74332/+138474.687247); trgb. Radius 182.1 +/- 30.4 solar radii from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 42.95 d in Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC3351, Cepheid = C1 (log(P) 1.633); not a measurement of this star: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, 0.067 dex (https://arxiv.org/abs/2002.02186). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,840 K from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 42.95 d in Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC3351, Cepheid = C1 (log(P) 1.633); not a measurement of this star: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)); the uncertainty is the 317 K by which the two relations miss the paper's own Cepheid temperatures. No surface gravity of this star is published.

**Color.** A Planck spectrum at 4,840 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe3ca. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,840 K and log g 0.7 (u1 0.671, u2 0.102): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.6% of the centre brightness from the one drawn, at log g 0.7, the gravity closest to all of them; log g 0.7 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from SIMBAD basic and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** Its radius and temperature are what Groenewegen (2020), A&A 635, A33's relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M95 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
