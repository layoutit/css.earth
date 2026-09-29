# EPIC 210768658

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.93 solar masses and 20.0 solar radii; APOGEE spectra give 4,450 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 50438107356842496, distance 3,320 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210768658 (K2 campaign 4): PARAM asteroseismic distance (pc) 3319.492188 (16th-84th percentiles 3168.476562-3509.257812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.305 ± 0.016 mas (18.9 standard errors), is not used. Radius 20.0397 +/- 1.345 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210768658 (K2 campaign 4): PARAM radius (solar radii) 20.039733 (16th-84th percentiles 18.926598-21.616498), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9299 +/- 0.1373 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210768658 (K2 campaign 4): PARAM mass (solar masses) 0.929864 (16th-84th percentiles 0.821589-1.096126), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,450 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210768658: APOGEE DR17 effective temperature 4449.835 +/- 50 K (the catalogue's final uncertainty). log g 1.8 from the mass and radius.

**Colour.** A Planck spectrum at 4,450 K, because pARAM fits an extinction A_V = 0.64 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,450 K and log g 1.8 (u1 0.785, u2 0.030): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
