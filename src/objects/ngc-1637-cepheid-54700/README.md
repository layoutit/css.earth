# NGC 1637 Cepheid 54700

## Sources

Leonard et al. (2003) list its pulsation at 54.4 days. It is one of the 18 Cepheids their distance to the galaxy rests on. The introduction is generated from Leonard et al. (2003), ApJ 594, 247's published values; the sections below are the data's own.

**Star.** Placement: Leonard et al. (2003), ApJ 594, 247, table 6 (ID 54700: chip 4, X 414.8, Y 216.8); its section 4.1 says the hstphot positions it reports are of the combined V-band frame, which no epoch leaves by more than about half a pixel, and that hstphot gives an integer to a star centred on a pixel's lower-left corner; read here on the first exposure of that series, u6fv0101m (table 3), MAST mast:HST/product/u6fv0101m_c0m.fits pixel extension = SCI,4, x = 414.8, y = 216.8, first pixel centre = 0.5; placed by that pixel, not by a Gaia source, distance 9,289,203 pc from Placed in NGC 1637 as the app draws it, where the star's sight line crosses the disc's midplane: 9,289,203 pc (src/objects/ngc-1637-layers/source/recipe.json: centre 9,289,664 pc, inclination 31.1 deg, line of nodes 20.6 deg). The galaxy's distance, which places the galaxy and not a star within it: Jones2009ApJ...696.1176J: Distance Determination to 12 Type II Supernovae Using the Expanding Photosphere Method (https://ui.adsabs.harvard.edu/abs/2009ApJ...696.1176J); catalogue reference Jones2009ApJ...696.1176J: 9289663.8678 pc (-458864.863614/+482708.341758); sn. Radius 216 +/- 36 solar radii from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 54.42 d in Leonard et al. (2003), ApJ 594, 247, table 8 (ID 54700: P 54.42 d); not a measurement of this star: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, 0.067 dex (https://arxiv.org/abs/2002.02186). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,770 K from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 54.42 d in Leonard et al. (2003), ApJ 594, 247, table 8 (ID 54700: P 54.42 d); not a measurement of this star: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)); the uncertainty is the 317 K by which the two relations miss the paper's own Cepheid temperatures. No surface gravity of this star is published.

**Color.** A Planck spectrum at 4,770 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,770 K and log g 0.65 (u1 0.692, u2 0.086): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.6% of the centre brightness from the one drawn, at log g 0.65, the gravity closest to all of them; log g 0.65 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from MAST mast:HST/product/u6fv0101m_c0m.fits and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** Its radius and temperature are what Groenewegen (2020), A&A 635, A33's relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within NGC 1637 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
