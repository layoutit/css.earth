# EPIC 210368383

## Sources

Its oscillations, recorded in K2 campaign 4, give 2.08 solar masses and 16.4 solar radii; APOGEE spectra give 4,909 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 38378766902407680, distance 3,448 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210368383 (K2 campaign 4): PARAM asteroseismic distance (pc) 3448.28125 (16th-84th percentiles 3226.601562-3579.414062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.433 ± 0.014 mas (29.9 standard errors), is not used. Radius 16.3947 +/- 0.9913 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210368383 (K2 campaign 4): PARAM radius (solar radii) 16.394685 (16th-84th percentiles 15.336581-17.319184), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.0794 +/- 0.2684 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210368383 (K2 campaign 4): PARAM mass (solar masses) 2.079402 (16th-84th percentiles 1.813603-2.350387), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,909 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210368383: APOGEE DR17 effective temperature 4909.243 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Colour.** A Planck spectrum at 4,909 K, because pARAM fits an extinction A_V = 0.62 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,909 K and log g 2.33 (u1 0.650, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
