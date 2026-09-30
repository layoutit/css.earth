# X Pup

## Sources

Its mean radius, 107.7 solar radii, comes from comparing how fast its surface moves with how its size changes, 2,534 parsecs away. It is also HD 60266, HIP 36685. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5620098679741674496, distance 2,534 pc from Groenewegen (2013), A&A 550, A70, table10, X Pup: Baade-Wesselink distance (pc) 2533.8 +/- 104.8 (Monte-Carlo); Gaia DR3's parallax, 0.376 ± 0.020 mas (18.7 standard errors), is not used. Radius 107.7 +/- 4.8 solar radii from Groenewegen (2013), A&A 550, A70, table10, X Pup: Baade-Wesselink mean radius (solar radii) 107.7 +/- 4.8 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,125 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 270, Name='X Pup', columns Teff, e_Teff (K): Teff 5125 +/- 301 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.58 from 2024A&A...690A.246T ("Cepheid Metallicity in the Leavitt Law (C-MetaLL) survey VI. Radial abundance gradients of 29 chemical species in the Milky Way disc.").

**Colour.** A Planck spectrum at 5,125 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.402 +/- 0.009 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,125 K and log g 0.58 (u1 0.596, u2 0.147): a model, because no fit of this star's limb is used. Gravity: log g 0.58 from 2024A&A...690A.246T, the median of its 2 spectra; the 8 published values span log g 0.28 to 1.77, across which the limb law changes by at most 1.7% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 5 harmonics of a 25.97-day period (vari_cepheid, source 5620098679741674496; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 2.485 mag, so at minimum the star gives 10% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.95 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0008 d from epoch_g (stated error 0.0046 d; 0.00003 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 168 cycles to the scene date; with the period's error the phase shown is known to 0.02 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
