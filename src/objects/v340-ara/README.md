# V340 Ara

## Sources

Its mean radius, 99.1 solar radii, comes from comparing how fast its surface moves with how its size changes, 3,712 parsecs away. It is also HIP 82023. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5937099633141128448, distance 3,712 pc from Groenewegen (2013), A&A 550, A70, table10, V340 Ara: Baade-Wesselink distance (pc) 3711.8 +/- 242.3 (Monte-Carlo); Gaia DR3's parallax, 0.206 ± 0.020 mas (10.5 standard errors), is not used. Radius 99.1 +/- 8.2 solar radii from Groenewegen (2013), A&A 550, A70, table10, V340 Ara: Baade-Wesselink mean radius (solar radii) 99.1 +/- 8.2 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,250 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 209, Name='V340 Ara', columns Teff, e_Teff (K): Teff 5250 +/- 323 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1 from 2023A&A...678A.195D ("Oxygen, sulfur, and iron radial abundance gradients of classical Cepheids across the Galactic thin disk.").

**Color.** A Planck spectrum at 5,250 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.546 +/- 0.048 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffead9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,250 K and log g 1 (u1 0.558, u2 0.181): a model, because no fit of this star's limb is used. Gravity: log g 1 from 2023A&A...678A.195D, the median of its 10 spectra; the 13 published values span log g 0.6 to 1.8, across which the limb law changes by at most 1.1% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 5 harmonics of a 20.82-day period (vari_cepheid, source 5937099633141128448; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.897 mag, so at minimum the star gives 44% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.16 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0065 d from epoch_g (stated error 0.0078 d; 0.00031 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 213 cycles to the scene date; with the period's error the phase shown is known to 0.06 of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
