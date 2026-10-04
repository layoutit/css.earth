# [GSF2000] NGC 3627 C36

## Sources

Gibson et al. (2000) list its pulsation at 53.1 days. The introduction is generated from Gibson et al. (2000), ApJ 529, 723's published values; the sections below are the data's own.

**Star.** Placement: Gibson et al. (2000), ApJ 529, 723, VizieR J/ApJ/529/723/appen Cluster = NGC 3627, CNN = C36 (Chip 4, Xpos 135.7, Ypos 125.4); the table names no exposure for this galaxy, so the pixel is read on the first exposure of its programme (GO 6549), u35i0101r, whose header places a pixel where those of four later epochs do, MAST mast:HST/product/u35i0101r_c0m.fits pixel extension = SCI,4, x = 135.7, y = 125.4, first pixel centre = 1 (SIMBAD [GSF2000] NGC 3627 C36); placed by that pixel, not by a Gaia source, distance 10,310,408 pc from Placed in M66 as the app draws it, where the star's sight line crosses the disc's midplane: 10,310,408 pc (src/objects/m66-layers/source/recipe.json: centre 10,313,356 pc, inclination 57.3 deg, line of nodes 173.1 deg). The galaxy's distance, which places the galaxy and not a star within it: Tully et al. (2023), Cosmicflows-4, ApJ 944, 94; CDS J/ApJ/944/94, table 2 (distances of individual galaxies), PGC 34695: distance modulus 30.067 ± 0.061 mag (https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94). Radius 212.2 +/- 35.4 solar radii from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 53.08 d in Gibson et al. (2000), ApJ 529, 723, VizieR J/ApJ/529/723/appen Cluster = NGC 3627, CNN = C36 (Per); not a measurement of this star: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, 0.067 dex (https://arxiv.org/abs/2002.02186). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,770 K from Groenewegen (2020), A&A 635, A33, period relations for Galactic fundamental-mode Cepheids applied to this star's period, 53.08 d in Gibson et al. (2000), ApJ 529, 723, VizieR J/ApJ/529/723/appen Cluster = NGC 3627, CNN = C36 (Per); not a measurement of this star: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)); the uncertainty is the 317 K by which the two relations miss the paper's own Cepheid temperatures. No surface gravity of this star is published.

**Color.** A Planck spectrum at 4,770 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,770 K and log g 0.65 (u1 0.692, u2 0.086): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.6% of the centre brightness from the one drawn, at log g 0.65, the gravity closest to all of them; log g 0.65 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from MAST mast:HST/product/u35i0101r_c0m.fits and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** Its radius and temperature are what Groenewegen (2020), A&A 635, A33's relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M66 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
