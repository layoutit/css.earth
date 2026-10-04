# M51-DS1

## Sources

Jencson et al. (2022) found it in a Hubble search for stars that vanish. Its light fits a star of 4,300 K, about 400,000 times as luminous as the Sun. The introduction is generated from Jencson et al. (2022), ApJ 930, 81's published values; the sections below are the data's own.

**Star.** Placement: Jencson et al. (2022), ApJ 930, 81, section 4.1 (13:29:56.16 +47:11:47.8); SIMBAD holds that position, from 2022ApJ...930...81J, SIMBAD basic row main_id = NAME M51-DS1 (SIMBAD NAME M51-DS1); placed by that row, not by a Gaia source, distance 8,341,566 pc from Placed in Whirlpool Galaxy as the app draws it, where the star's sight line crosses the disc's midplane: 8,341,566 pc (src/objects/m51-layers/source/recipe.json: centre 8,340,652 pc, inclination 32.6 deg, line of nodes 163 deg). The galaxy's distance, which places the galaxy and not a star within it: Tully et al. (2023), Cosmicflows-4, ApJ 944, 94; CDS J/ApJ/944/94, table 2 (distances of individual galaxies), PGC 47404: distance modulus 29.606 ± 0.079 mag (https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94). Radius 1137 +/- 372 solar radii from Jencson et al. (2022), ApJ 930, 81, section 4.4.1: log(L/L_sun) = 5.60 for the best-fitting model (5.35 to 5.75 for the models that fit well, at the paper's distance modulus of M51, 29.67) and T_eff = 4300 K (3700 to 4700 K), through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolution B3, Prsa et al. 2016, arXiv:1605.09788); the paper prints no radius, and no measurement of this star's size exists (https://doi.org/10.3847/1538-4357/ac626c). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,300 K from Jencson et al. (2022), ApJ 930, 81, section 4.4.1: the model that best fits the star's light before its 2019 dimming has T_eff = 4300 K; the models that fit well span 3700 to 4700 K. No surface gravity of this star is published.

**Color.** A Planck spectrum at 4,300 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffdab3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,300 K and log g 0.4 (u1 0.833, u2 -0.020): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Levesque et al. (2005), ApJ 628, 973, table 4 (the gravities it computes for the Galactic K- and M-type supergiants of known distance that it fits) gives the class's range, log g -0.9 to 1.3. Across log g 0 to 1.3, the part the grid covers, the limb laws differ by at most 1.0% of the centre brightness from the one drawn, at log g 0.4, the gravity closest to all of them; log g 0.4 is a display choice, not a measurement.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from SIMBAD basic and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star varies; it is drawn at the radius its published luminosity and temperature give.
- **Not shown.** Its radius is not measured: it follows from the paper's luminosity and temperature.
- **Not shown.** The paper also allows a cooler red supergiant, under 3,700 K at log L 5.2 to 5.3, if less dust lies in front of the star.
- **Not shown.** Its limb is read at the gravities published for Galactic K and M supergiants; no gravity of this star is measured.
- **Not shown.** Its radial velocity is its galaxy's; its own motion within M51 is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
