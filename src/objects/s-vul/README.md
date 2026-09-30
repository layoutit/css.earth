# S Vul

## Sources

Its mean radius, 272.4 solar radii, comes from comparing how fast its surface moves with how its size changes, 3,880 parsecs away. It is also HD 338867. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2027971514401523456, distance 3,880 pc from Groenewegen (2013), A&A 550, A70, table10, S Vul: Baade-Wesselink distance (pc) 3879.9 +/- 195.8 (Monte-Carlo); Gaia DR3's parallax, 0.205 ± 0.020 mas (10.2 standard errors), is not used. Radius 272.4 +/- 13.2 solar radii from Groenewegen (2013), A&A 550, A70, table10, S Vul: Baade-Wesselink mean radius (solar radii) 272.4 +/- 13.2 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,625 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 159, Name='S Vul', columns Teff, e_Teff (K): Teff 4625 +/- 189 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.93 from Luck (2018), AJ 156, 171, VizieR J/AJ/156/171/table11, recno 52, Name='S Vul', column Gavg ('Average gravity over cycle'; log g in dex, ReadMe unit label cm/s2): log g 0.93 averaged over the pulsation cycle.

**Colour.** A Planck spectrum at 4,625 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.727 +/- 0.043 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,625 K and log g 0.93 (u1 0.728, u2 0.067): a model, because no fit of this star's limb is used.

**Brightness.** Gaia DR3 fits the star's G-band light with 2 harmonics of a 69.47-day period (vari_cepheid, source 2027971514401523456; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.425 mag, so at minimum the star gives 68% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.24 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0042 d from epoch_g (stated error 0.0654 d; 0.00006 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 64 cycles to the scene date; with the period's error the phase shown is known to 0.04 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
