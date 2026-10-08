# VZ Pup

## Sources

Its mean radius, 97.3 solar radii, comes from comparing how fast its surface moves with how its size changes, 4,134 parsecs away. It is also HIP 37207. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5600052040150252800, distance 4,134 pc from Groenewegen (2013), A&A 550, A70, table10, VZ Pup: Baade-Wesselink distance (pc) 4134.1 +/- 98.2 (Monte-Carlo); Gaia DR3's parallax, 0.201 ± 0.015 mas (13.7 standard errors), is not used. Radius 97.3 +/- 2.3 solar radii from Groenewegen (2013), A&A 550, A70, table10, VZ Pup: Baade-Wesselink mean radius (solar radii) 97.3 +/- 2.3 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,125 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 258, Name='VZ Pup', columns Teff, e_Teff (K): Teff 5125 +/- 189 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.24 from 2024A&A...690A.246T ("Cepheid Metallicity in the Leavitt Law (C-MetaLL) survey VI. Radial abundance gradients of 29 chemical species in the Milky Way disc.").

**Color.** A Planck spectrum at 5,125 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.459 +/- 0.011 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,125 K and log g 0.24 (u1 0.603, u2 0.133): a model, because no fit of this star's limb is used. Gravity: log g 0.24 from 2024A&A...690A.246T, the median of its 2 spectra; the 7 published values span log g 0.06 to 2.2, across which the limb law changes by at most 2.7% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 6 harmonics of a 23.17-day period (vari_cepheid, source 5600052040150252800; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 1.095 mag, so at minimum the star gives 36% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.12 of a cycle after maximum. It plays when Motion is on.

**Pulsation.** The 10 steps of the Pulsation dataset are the model Gaia DR3 publishes of the star's G-band light (vari_cepheid, source 5600052040150252800: 6 harmonics of a 23.17-day period; the same row as [the source record](../../sources/gaia-dr3-vari-cepheid-vz-pup.json)), evaluated in this project a tenth of a period apart, from maximum light ([method note](../../../docs/pulsating-stars-light-through-a-cycle.md)). Each step draws the star's color dimmed to that phase's share of its light at maximum: 100, 79, 74, 67, 59, 51, 46, 43, 39, 49%.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0005 d from epoch_g (stated error 0.0028 d; 0.00002 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 189 cycles to the scene date; with the period's error the phase shown is known to 0.02 of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.

- **Pulsation.** The steps show the light alone. The star's color and its size change through the cycle and are not drawn: no published calibration found turns Gaia's two colors into a Cepheid's temperature, and nothing here measures this star's size through the cycle. 10 steps a tenth of a period apart are a display choice; the model between them is continuous.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
