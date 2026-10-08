# HV 899

## Sources

Its mean radius, 128 solar radii, comes from comparing how fast its surface moves with how its size changes, 47,670 parsecs away. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4661266369343899904, distance 47,670 pc from Groenewegen (2013), A&A 550, A70, table10, HV 899: Baade-Wesselink distance (pc) 47670.4 +/- 1397.6 (Monte-Carlo); Gaia DR3's parallax, -0.003 ± 0.015 mas (-0.2 standard errors), is not used. Radius 128 +/- 3.8 solar radii from Groenewegen (2013), A&A 550, A70, table10, HV 899: Baade-Wesselink mean radius (solar radii) 128 +/- 3.8 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,250 K from Groenewegen & Lub (2023), A&A 676, A136, VizieR J/A+A/676/A136/table1, Name=LMC0986, columns Teffp, e_Teffp: Teff 5250 +/- 125 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.1 from 2022A&A...658A..29R ("The iron and oxygen content of LMC Classical Cepheids and its implications for the extragalactic distance scale and Hubble constant. Equivalent width analysis with Kurucz stellar atmosphere models.").

**Color.** A Planck spectrum at 5,250 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.11 +/- 0.005 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffead9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,250 K and log g 0.1 (u1 0.574, u2 0.146): a model, because no fit of this star's limb is used. Gravity: log g 0.1 from 2022A&A...658A..29R; the 1 published value span log g 0.1 to 0.1, across which the limb law changes by at most 0.0% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 3 harmonics of a 31.06-day period (vari_cepheid, source 4661266369343899904; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 1.032 mag, so at minimum the star gives 39% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.21 of a cycle after maximum. It plays when Motion is on.

**Pulsation.** The 10 steps of the Pulsation dataset are the model Gaia DR3 publishes of the star's G-band light (vari_cepheid, source 4661266369343899904: 3 harmonics of a 31.06-day period; the same row as [the source record](../../sources/gaia-dr3-vari-cepheid-hv-899.json)), evaluated in this project a tenth of a period apart, from maximum light ([method note](../../../docs/pulsating-stars-light-through-a-cycle.md)). Each step draws the star's color dimmed to that phase's share of its light at maximum: 100, 91, 82, 74, 65, 57, 45, 39, 51, 82%.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0025 d from epoch_g (stated error 0.0062 d; 0.00008 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Not shown.** No surface gravity averaged over the pulsation is published, only single-phase values, so no limb darkening is drawn.
- **Not shown.** Its distance is the Baade-Wesselink one its radius was measured at, so the Magellanic Cepheids spread a few kiloparsecs in depth.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 144 cycles to the scene date; with the period's error the phase shown is known to 0.02 of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.

- **Pulsation.** The steps show the light alone. The star's color and its size change through the cycle and are not drawn: no published calibration found turns Gaia's two colors into a Cepheid's temperature, and nothing here measures this star's size through the cycle. 10 steps a tenth of a period apart are a display choice; the model between them is continuous.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
