# CR Ser

## Sources

Its mean radius, 70.4 solar radii, comes from comparing how fast its surface moves with how its size changes, 2,611 parsecs away. It is also HIP 89013. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4147381366335558784, distance 2,611 pc from Groenewegen (2013), A&A 550, A70, table10, CR Ser: Baade-Wesselink distance (pc) 2610.9 +/- 519.6 (Monte-Carlo); Gaia DR3's parallax, 0.535 ± 0.020 mas (27.4 standard errors), is not used. Radius 70.4 +/- 14.2 solar radii from Groenewegen (2013), A&A 550, A70, table10, CR Ser: Baade-Wesselink mean radius (solar radii) 70.4 +/- 14.2 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,375 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 443, Name='CR Ser', columns Teff, e_Teff (K): Teff 5375 +/- 125 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.3 from 2023A&A...678A.195D ("Oxygen, sulfur, and iron radial abundance gradients of classical Cepheids across the Galactic thin disk.").

**Color.** A Planck spectrum at 5,375 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.961 +/- 0.087 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffecdd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,375 K and log g 1.3 (u1 0.530, u2 0.201): a model, because no fit of this star's limb is used. Gravity: log g 1.3 from 2023A&A...678A.195D; the 1 published value span log g 1.3 to 1.3, across which the limb law changes by at most 0.0% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 4 harmonics of a 5.301-day period (vari_cepheid, source 4147381366335558784; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.570 mag, so at minimum the star gives 59% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.35 of a cycle after maximum. It plays when Motion is on.

**Pulsation.** The 10 steps of the Pulsation dataset are the model Gaia DR3 publishes of the star's G-band light (vari_cepheid, source 4147381366335558784: 4 harmonics of a 5.301-day period; the same row as [the source record](../../sources/gaia-dr3-vari-cepheid-cr-ser.json)), evaluated in this project a tenth of a period apart, from maximum light ([method note](../../../docs/pulsating-stars-light-through-a-cycle.md)). Each step draws the star's color dimmed to that phase's share of its light at maximum: 100, 92, 85, 78, 73, 68, 62, 60, 63, 84%.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0022 d from epoch_g (stated error 0.0003 d; 0.00042 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 827 cycles to the scene date; with the period's error the phase shown is known to 0.03 of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.

- **Pulsation.** The steps show the light alone. The star's color and its size change through the cycle and are not drawn: no published calibration found turns Gaia's two colors into a Cepheid's temperature, and nothing here measures this star's size through the cycle. 10 steps a tenth of a period apart are a display choice; the model between them is continuous.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
