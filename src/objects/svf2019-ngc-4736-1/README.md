# [SVF2019] NGC 4736-1

## Sources

Solovyeva et al. (2019) found it by its spectrum and saw its light change by 1.1 magnitudes from 2005 to 2018. They estimate its temperature at 18,000 K. The introduction is generated from Solovyeva et al. (2019), MNRAS 484, L24's published values; the sections below are the data's own.

**Star.** Placement: Solovyeva et al. (2019), MNRAS 484, L24, section 2 (its HST coordinates, 12:50:57.264 +41:07:23.13); SIMBAD holds that position, from 2019MNRAS.484L..24S, SIMBAD basic row main_id = [SVF2019] NGC 4736-1 (SIMBAD [SVF2019] NGC 4736-1); placed by that row, not by a Gaia source, distance 4,337,391 pc from Placed in M94 as the app draws it, where the star's sight line crosses the disc's midplane: 4,337,391 pc (src/objects/m94-layers/source/recipe.json: centre 4,337,106 pc, inclination 31.77 deg, line of nodes 105 deg). The galaxy's distance, which places the galaxy and not a star within it: Tully et al. (2023), Cosmicflows-4, ApJ 944, 94; CDS J/ApJ/944/94, table 2 (distances of individual galaxies), PGC 43495: distance modulus 28.186 ± 0.039 mag (https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94). Radius 183 +/- 74 solar radii from Solovyeva et al. (2019), MNRAS 484, L24, section 3.1: log(L_bol/L_sun) = 6.5 +/- 0.2 (at the paper's distance modulus of M94, 28.31) and T = 18 +/- 3 kK, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolution B3, Prsa et al. 2016, arXiv:1605.09788); the paper prints no radius, and no measurement of this star's size exists (https://arxiv.org/abs/1901.05277). No mass is measured, so GM is 0, the records' unpublished value. Temperature 18,000 K from Solovyeva et al. (2019), MNRAS 484, L24, section 3.1: photosphere temperature T = 18 +/- 3 kK, estimated from the strengths of its He I and Fe II lines. No surface gravity of this star is published.

**Color.** A Planck spectrum at 18,000 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #aec4ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Reeve & Howarth (2016), MNRAS 456, 1294 compute from non-LTE TLUSTY B-star model atmospheres for the Bessell V band at 18,000 K and log g 2.15 (u1 0.290, u2 0.271): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Clark et al. (2012), A&A 541, A145, table 4 (the model gravities of the four Galactic early-B hypergiants it analyses, at 13.7 to 18.1 kK, stars it finds intermediate between B supergiants and luminous blue variables) gives the class's range, log g 1.7 to 2.38. Across log g 2 to 2.35, the part the grid covers, the limb laws differ by at most 3.3% of the centre brightness from the one drawn, at log g 2.15, the gravity closest to all of them; log g 2.15 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from SIMBAD basic and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star varies; it is drawn at the radius its published luminosity and temperature give.
- **Not shown.** Its radius is not measured: it follows from the paper's luminosity and temperature.
- **Not shown.** Its limb is read at the gravities published for early-B hypergiants; no gravity of this star is measured.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M94 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
