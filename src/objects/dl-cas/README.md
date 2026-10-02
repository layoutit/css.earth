# DL Cas

## Sources

Its mean radius, 60.7 solar radii, comes from comparing how fast its surface moves with how its size changes, 1,845 parsecs away. It is also HD 236429, HIP 2347. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 428620663657823232, distance 1,845 pc from Groenewegen (2013), A&A 550, A70, table10, DL Cas: Baade-Wesselink distance (pc) 1845.1 +/- 182.6 (Monte-Carlo); Gaia DR3's parallax, 0.553 ± 0.027 mas (20.2 standard errors), is not used. Radius 60.7 +/- 6 solar radii from Groenewegen (2013), A&A 550, A70, table10, DL Cas: Baade-Wesselink mean radius (solar radii) 60.7 +/- 6 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,500 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 69, Name='DL Cas', columns Teff, e_Teff (K): Teff 5500 +/- 177 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.17 from 2024A&A...690A.246T ("Cepheid Metallicity in the Leavitt Law (C-MetaLL) survey VI. Radial abundance gradients of 29 chemical species in the Milky Way disc.").

**Color.** A Planck spectrum at 5,500 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.488 +/- 0.01 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffede1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,500 K and log g 1.17 (u1 0.504, u2 0.212): a model, because no fit of this star's limb is used. Gravity: log g 1.17 from 2024A&A...690A.246T; the 4 published values span log g 1.17 to 1.7, across which the limb law changes by at most 0.7% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 4 harmonics of a 8.001-day period (vari_cepheid, source 428620663657823232; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.453 mag, so at minimum the star gives 66% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.09 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0021 d from epoch_g (stated error 0.0003 d; 0.00026 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 551 cycles to the scene date; with the period's error the phase shown is known to 0.01 of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
