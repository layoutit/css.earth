# AN Aur

## Sources

Its mean radius, 93.6 solar radii, comes from comparing how fast its surface moves with how its size changes, 5,302 parsecs away. It is also HIP 23210. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 201574982848108416, distance 5,302 pc from Groenewegen (2013), A&A 550, A70, table10, AN Aur: Baade-Wesselink distance (pc) 5301.6 +/- 463.4 (Monte-Carlo); Gaia DR3's parallax, 0.249 ± 0.018 mas (13.6 standard errors), is not used. Radius 93.6 +/- 8.1 solar radii from Groenewegen (2013), A&A 550, A70, table10, AN Aur: Baade-Wesselink mean radius (solar radii) 93.6 +/- 8.1 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,500 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 14, Name='AN Aur', columns Teff, e_Teff (K): Teff 5500 +/- 153 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.94 from 2011AJ....141...53S ("Spectra of type II cepheid candidates and related stars.").

**Colour.** A Planck spectrum at 5,500 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.6 +/- 0.057 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffede1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,500 K and log g 1.94 (u1 0.499, u2 0.228): a model, because no fit of this star's limb is used. Gravity: log g 1.94 from 2011AJ....141...53S; the 2 published values span log g 1.94 to 2.13, across which the limb law changes by at most 0.2% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 4 harmonics of a 10.29-day period (vari_cepheid, source 201574982848108416; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.617 mag, so at minimum the star gives 57% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.63 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0001 d from epoch_g (stated error 0.0007 d; 0.00001 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 429 cycles to the scene date; with the period's error the phase shown is known to 0.02 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
