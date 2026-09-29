# V1162 Aql

## Sources

Its mean radius, 42.7 solar radii, comes from comparing how fast its surface moves with how its size changes, 1,249 parsecs away. It is also HD 187820, HIP 97794. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4190143160245024256, distance 1,249 pc from Groenewegen (2013), A&A 550, A70, table10, V1162 Aql: Baade-Wesselink distance (pc) 1249.2 +/- 305.1 (Monte-Carlo); Gaia DR3's parallax, 0.787 ± 0.023 mas (34.4 standard errors), is not used. Radius 42.7 +/- 10.9 solar radii from Groenewegen (2013), A&A 550, A70, table10, V1162 Aql: Baade-Wesselink mean radius (solar radii) 42.7 +/- 10.9 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,625 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 202, Name='V1162 Aql', columns Teff, e_Teff (K): Teff 5625 +/- 168 K from a fit to the spectral energy distribution at mean light (not spectroscopic). No surface gravity of this star is published.

**Colour.** A Planck spectrum at 5,625 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.205 +/- 0.021 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffefe5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,625 K and log g 0.4 (u1 0.556, u2 0.148): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.9% of the centre brightness from the one drawn, at log g 0.4, the gravity closest to all of them; log g 0.4 is a display choice, not a measurement.

**Brightness.** Gaia DR3 fits the star's G-band light with 3 harmonics of a 5.376-day period (vari_cepheid, source 4190143160245024256; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.430 mag, so at minimum the star gives 67% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.13 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0015 d from epoch_g (stated error 0.0001 d; 0.00028 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 815 cycles to the scene date; with the period's error the phase shown is known to 0.01 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
