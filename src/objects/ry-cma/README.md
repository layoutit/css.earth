# RY CMa

## Sources

Its mean radius, 38.7 solar radii, comes from comparing how fast its surface moves with how its size changes, 1,248 parsecs away. It is also HD 56450, HIP 35212. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3046774762417915136, distance 1,248 pc from Groenewegen (2013), A&A 550, A70, table10, RY CMa: Baade-Wesselink distance (pc) 1248.2 +/- 99.5 (Monte-Carlo); Gaia DR3's parallax, 0.801 ± 0.029 mas (27.5 standard errors), is not used. Radius 38.7 +/- 3.1 solar radii from Groenewegen (2013), A&A 550, A70, table10, RY CMa: Baade-Wesselink mean radius (solar radii) 38.7 +/- 3.1 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,625 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 141, Name='RY CMa', columns Teff, e_Teff (K): Teff 5625 +/- 153 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.42 from 2024A&A...690A.246T ("Cepheid Metallicity in the Leavitt Law (C-MetaLL) survey VI. Radial abundance gradients of 29 chemical species in the Milky Way disc.").

**Colour.** A Planck spectrum at 5,625 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.239 +/- 0.01 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffefe5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,625 K and log g 1.42 (u1 0.480, u2 0.230): a model, because no fit of this star's limb is used. Gravity: log g 1.42 from 2024A&A...690A.246T, the median of its 2 spectra; the 7 published values span log g 1.2 to 2.1, across which the limb law changes by at most 0.7% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 4 harmonics of a 4.678-day period (vari_cepheid, source 3046774762417915136; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 0.615 mag, so at minimum the star gives 57% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.80 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0000 d from epoch_g (stated error 0.0000 d; 0.00000 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 936 cycles to the scene date; with the period's error the phase shown is known to 0.01 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
