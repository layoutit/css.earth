# HV 881

## Sources

Its mean radius, 121.2 solar radii, comes from comparing how fast its surface moves with how its size changes, 40,336 parsecs away. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4655107381879225856, distance 40,336 pc from Groenewegen (2013), A&A 550, A70, table10, HV 881: Baade-Wesselink distance (pc) 40336 +/- 1065.7 (Monte-Carlo); Gaia DR3's parallax, 0.042 ± 0.017 mas (2.5 standard errors), is not used. Radius 121.2 +/- 3.2 solar radii from Groenewegen (2013), A&A 550, A70, table10, HV 881: Baade-Wesselink mean radius (solar radii) 121.2 +/- 3.2 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,125 K from Groenewegen & Lub (2023), A&A 676, A136, VizieR J/A+A/676/A136/table1, Name=LMC0528, columns Teffp, e_Teffp: Teff 5125 +/- 189 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.1 from 2022A&A...658A..29R ("The iron and oxygen content of LMC Classical Cepheids and its implications for the extragalactic distance scale and Hubble constant. Equivalent width analysis with Kurucz stellar atmosphere models.").

**Color.** A Planck spectrum at 5,125 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.03 +/- 0.005 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,125 K and log g 0.1 (u1 0.606, u2 0.126): a model, because no fit of this star's limb is used. Gravity: log g 0.1 from 2022A&A...658A..29R; the 2 published values span log g 0.1 to 1.68, across which the limb law changes by at most 2.8% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 2 harmonics of a 35.66-day period (vari_cepheid, source 4655107381879225856; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.916 mag, so at minimum the star gives 43% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.71 of a cycle after maximum. It plays when Motion is on.

**Pulsation.** The 10 steps of the Pulsation dataset are the model Gaia DR3 publishes of the star's G-band light (vari_cepheid, source 4655107381879225856: 2 harmonics of a 35.66-day period; the same row as [the source record](../../sources/gaia-dr3-vari-cepheid-hv-881.json)), evaluated in this project a tenth of a period apart, from maximum light ([method note](../../../docs/pulsating-stars-light-through-a-cycle.md)). Each step draws the star's color dimmed to that phase's share of its light at maximum: 100, 91, 78, 71, 64, 53, 44, 46, 62, 87%.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0043 d from epoch_g (stated error 0.0658 d; 0.00012 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Not shown.** No surface gravity averaged over the pulsation is published, only single-phase values, so no limb darkening is drawn.
- **Not shown.** Its distance is the Baade-Wesselink one its radius was measured at, so the Magellanic Cepheids spread a few kiloparsecs in depth.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 126 cycles to the scene date; with the period's error the phase shown is known to 0.16 of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.

- **Pulsation.** The steps show the light alone. The star's color and its size change through the cycle and are not drawn: no published calibration found turns Gaia's two colors into a Cepheid's temperature, and nothing here measures this star's size through the cycle. 10 steps a tenth of a period apart are a display choice; the model between them is continuous.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
