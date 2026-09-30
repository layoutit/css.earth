# HV 12505

## Sources

Its mean radius, 76.3 solar radii, comes from comparing how fast its surface moves with how its size changes, 46,661 parsecs away. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4655312101566701824, distance 46,661 pc from Groenewegen (2013), A&A 550, A70, table10, HV 12505: Baade-Wesselink distance (pc) 46661.2 +/- 4095 (Monte-Carlo); Gaia DR3's parallax, -0.002 ± 0.016 mas (-0.1 standard errors), is not used. Radius 76.3 +/- 6.2 solar radii from Groenewegen (2013), A&A 550, A70, table10, HV 12505: Baade-Wesselink mean radius (solar radii) 76.3 +/- 6.2 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,000 K from Groenewegen & Lub (2023), A&A 676, A136, VizieR J/A+A/676/A136/table1, Name=LMC0504, columns Teffp, e_Teffp: Teff 5000 +/- 189 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.46 from 2022AJ....163..152S ("APOGEE Net: An Expanded Spectral Model of Both Low-mass and High-mass Stars."), the APOGEE Net pipeline.

**Colour.** A Planck spectrum at 5,000 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.1 +/- 0.005 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,000 K and log g 1.46 (u1 0.623, u2 0.146): a model, because no fit of this star's limb is used. Gravity: log g 1.46 from 2022AJ....163..152S (APOGEE Net, a survey pipeline: no analysis of this star's own spectra is published); the 2 published values span log g 0.925 to 1.46, across which the limb law changes by at most 0.8% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 5 harmonics of a 14.39-day period (vari_cepheid, source 4655312101566701824; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.806 mag, so at minimum the star gives 48% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.99 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0056 d from epoch_g (stated error 0.0031 d; 0.00039 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Not shown.** No surface gravity averaged over the pulsation is published, only single-phase values, so no limb darkening is drawn.
- **Not shown.** Its distance is the Baade-Wesselink one its radius was measured at, so the Magellanic Cepheids spread a few kiloparsecs in depth.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 308 cycles to the scene date; with the period's error the phase shown is known to 0.05 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
