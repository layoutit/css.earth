# EPIC 210976630

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.70 solar masses and 28.9 solar radii; APOGEE spectra give 4,412 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 61827467272323840, distance 4,237 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210976630 (K2 campaign 4): PARAM asteroseismic distance (pc) 4236.484375 (16th-84th percentiles 4039.492188-4396.328125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.339 ± 0.014 mas (23.8 standard errors), is not used. Radius 28.9274 +/- 1.6732 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210976630 (K2 campaign 4): PARAM radius (solar radii) 28.92741 (16th-84th percentiles 27.236241-30.582672), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.696 +/- 0.2062 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210976630 (K2 campaign 4): PARAM mass (solar masses) 1.696017 (16th-84th percentiles 1.484932-1.897417), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,412 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210976630: APOGEE DR17 effective temperature 4412.151 +/- 50 K (the catalogue's final uncertainty). log g 1.74 from the mass and radius.

**Colour.** A Planck spectrum at 4,412 K, because pARAM fits an extinction A_V = 0.68 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,412 K and log g 1.74 (u1 0.798, u2 0.020): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
