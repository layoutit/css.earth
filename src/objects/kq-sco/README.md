# KQ Sco

## Sources

Its mean radius, 149.2 solar radii, comes from comparing how fast its surface moves with how its size changes, 2,398 parsecs away. It is also HD 328953, HIP 82498. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5964193485048327808, distance 2,398 pc from Groenewegen (2013), A&A 550, A70, table10, KQ Sco: Baade-Wesselink distance (pc) 2398.3 +/- 97.5 (Monte-Carlo); Gaia DR3's parallax, 0.432 ± 0.021 mas (20.5 standard errors), is not used. Radius 149.2 +/- 5.9 solar radii from Groenewegen (2013), A&A 550, A70, table10, KQ Sco: Baade-Wesselink mean radius (solar radii) 149.2 +/- 5.9 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,750 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 113, Name='KQ Sco', columns Teff, e_Teff (K): Teff 4750 +/- 301 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.2 from 2023A&A...678A.195D ("Oxygen, sulfur, and iron radial abundance gradients of classical Cepheids across the Galactic thin disk.").

**Colour.** A Planck spectrum at 4,750 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.869 +/- 0.02 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,750 K and log g 1.2 (u1 0.690, u2 0.098): a model, because no fit of this star's limb is used. Gravity: log g 1.2 from 2023A&A...678A.195D, the median of its 3 spectra; the 6 published values span log g 0.4 to 1.4, across which the limb law changes by at most 1.2% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 4 harmonics of a 28.70-day period (vari_cepheid, source 5964193485048327808; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.644 mag, so at minimum the star gives 55% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.17 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0109 d from epoch_g (stated error 0.0162 d; 0.00038 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 155 cycles to the scene date; with the period's error the phase shown is known to 0.06 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
