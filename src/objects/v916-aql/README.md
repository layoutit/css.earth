# V916 Aql

## Sources

Its mean radius, 90.7 solar radii, comes from comparing how fast its surface moves with how its size changes, 3,592 parsecs away. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4313179507891570304, distance 3,592 pc from Groenewegen (2013), A&A 550, A70, table10, V916 Aql: Baade-Wesselink distance (pc) 3591.9 +/- 204.6 (Monte-Carlo); Gaia DR3's parallax, 0.299 ± 0.017 mas (17.3 standard errors), is not used. Radius 90.7 +/- 4.9 solar radii from Groenewegen (2013), A&A 550, A70, table10, V916 Aql: Baade-Wesselink mean radius (solar radii) 90.7 +/- 4.9 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,500 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 308, Name='V916 Aql', columns Teff, e_Teff (K): Teff 5500 +/- 250 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.52 from 2011AJ....141...53S ("Spectra of type II cepheid candidates and related stars.").

**Colour.** A Planck spectrum at 5,500 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 1.089 +/- 0.064 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffede1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,500 K and log g 0.52 (u1 0.515, u2 0.194): a model, because no fit of this star's limb is used. Gravity: log g 0.52 from 2011AJ....141...53S; the 2 published values span log g 0.52 to 1.44, across which the limb law changes by at most 1.2% of the centre brightness.

**Brightness.** Gaia DR3 fits the star's G-band light with 3 harmonics of a 13.44-day period (vari_cepheid, source 4313179507891570304; the fit is described by Ripepi et al. (2023), A&A 674, A17). It swings 1.001 mag, so at minimum the star gives 40% of its peak light. The page plays that model: a black veil over the disc passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, 3 days of the cycle each second (a display rate). It starts at the phase for the scene date, 2026-09-03T00:00:00 TT: 0.61 of a cycle after maximum. It plays when Motion is on.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on 2026-09-28 the model's maximum fell 0.0028 d from epoch_g (stated error 0.0026 d; 0.00021 of a period).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.
- **Brightness.** The model is Gaia's 2014-2017 fit carried 328 cycles to the scene date; with the period's error the phase shown is known to 0.04 of a cycle, and period changes after 2017 are not included. The G band stands for all colours: the star's temperature and colour change through the cycle, and the page does not show that.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
