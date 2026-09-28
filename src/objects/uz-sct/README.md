# UZ Sct

## Sources

Its mean radius, 85.6 solar radii, comes from comparing how fast its surface moves with how its size changes, 3,088 parsecs away. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4104869264724284544, distance 3,088 pc from Groenewegen (2013), A&A 550, A70, table10, UZ Sct: Baade-Wesselink distance (pc) 3087.7 +/- 140.9 (Monte-Carlo); Gaia DR3's parallax, 0.276 ± 0.025 mas (11.1 standard errors), is not used. Radius 85.6 +/- 3.8 solar radii from Groenewegen (2013), A&A 550, A70, table10, UZ Sct: Baade-Wesselink mean radius (solar radii) 85.6 +/- 3.8 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,875 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 200, Name='UZ Sct', columns Teff, e_Teff (K): Teff 4875 +/- 153 K from a fit to the spectral energy distribution at mean light (not spectroscopic). No surface gravity is known.

**Colour.** A Planck spectrum at 4,875 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 1.071 +/- 0.066 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** No limb darkening is drawn: no surface gravity is known: the mass is unmeasured and no spectroscopic log g is cited.

**Brightness.** Gaia DR3 fits the star's G-band light with 5 harmonics of a 14.75-day period (vari_cepheid, source 4104869264724284544; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.673 mag, so at minimum the star gives 54% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, one day of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.70 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0032 d from epoch_g (stated error 0.0024 d; 0.00022 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 299 cycles to the scene date; with the period's error the phase shown is known to 0.03 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
