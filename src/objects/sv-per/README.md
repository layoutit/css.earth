# SV Per

## Sources

Its mean radius, 80.4 solar radii, comes from comparing how fast its surface moves with how its size changes, 2,809 parsecs away. It is also HD 276861, HIP 22445. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 203496585576324224, distance 2,809 pc from Groenewegen (2013), A&A 550, A70, table10, SV Per: Baade-Wesselink distance (pc) 2809 +/- 249.8 (Monte-Carlo); Gaia DR3's parallax, 0.163 ± 0.212 mas (0.8 standard errors), is not used. Radius 80.4 +/- 7.3 solar radii from Groenewegen (2013), A&A 550, A70, table10, SV Per: Baade-Wesselink mean radius (solar radii) 80.4 +/- 7.3 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,375 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 158, Name='SV Per', columns Teff, e_Teff (K): Teff 5375 +/- 253 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.44 from 2024A&A...690A.246T ("Cepheid Metallicity in the Leavitt Law (C-MetaLL) survey VI. Radial abundance gradients of 29 chemical species in the Milky Way disc.").

**Colour.** A Planck spectrum at 5,375 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.408 +/- 0.018 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffecdd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,375 K and log g 0.44 (u1 0.547, u2 0.171): a model, because no fit of this star's limb is used. Gravity: log g 0.44 from 2024A&A...690A.246T, the median of its 3 spectra; the 8 published values span log g 0.34 to 2.17, across which the limb law changes by at most 2.2% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 6 harmonics of a 11.13-day period (vari_cepheid, source 203496585576324224; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.647 mag, so at minimum the star gives 55% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.66 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0016 d from epoch_g (stated error 0.0017 d; 0.00014 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 396 cycles to the scene date; with the period's error the phase shown is known to 0.04 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
