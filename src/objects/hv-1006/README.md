# HV 1006

## Sources

Its mean radius, 73.9 solar radii, comes from comparing how fast its surface moves with how its size changes, 42,626 parsecs away. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4657656737101291392, distance 42,626 pc from Groenewegen (2013), A&A 550, A70, table10, HV 1006: Baade-Wesselink distance (pc) 42626.4 +/- 3293.9 (Monte-Carlo); Gaia DR3's parallax, -0.044 ± 0.021 mas (-2.1 standard errors), is not used. Radius 73.9 +/- 5.3 solar radii from Groenewegen (2013), A&A 550, A70, table10, HV 1006: Baade-Wesselink mean radius (solar radii) 73.9 +/- 5.3 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,250 K from Groenewegen & Lub (2023), A&A 676, A136, VizieR J/A+A/676/A136/table1, Name=LMC2636, columns Teffp, e_Teffp: Teff 5250 +/- 125 K from a fit to the spectral energy distribution at mean light (not spectroscopic). No surface gravity is known.

**Colour.** A Planck spectrum at 5,250 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.1 +/- 0.005 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffead9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** No limb darkening is drawn: no surface gravity is known: the mass is unmeasured and no spectroscopic log g is cited.

**Brightness.** Gaia DR3 fits the star's G-band light with 3 harmonics of a 14.21-day period (vari_cepheid, source 4657656737101291392; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.928 mag, so at minimum the star gives 43% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 4 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.02 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0071 d from epoch_g (stated error 0.0044 d; 0.00050 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Not shown.** No surface gravity averaged over the pulsation is published, only single-phase values, so no limb darkening is drawn.
- **Not shown.** Its distance is the Baade-Wesselink one its radius was measured at, so the Magellanic Cepheids spread a few kiloparsecs in depth.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 312 cycles to the scene date; with the period's error the phase shown is known to 0.07 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
