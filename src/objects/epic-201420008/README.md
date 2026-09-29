# EPIC 201420008

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.73 solar masses and 7.7 solar radii; APOGEE spectra give 4,865 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3803936471166994944, distance 3,243 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201420008 (K2 campaign 1): PARAM asteroseismic distance (pc) 3242.5 (16th-84th percentiles 3199.179688-3290.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.240 ± 0.017 mas (13.9 standard errors), is not used. Radius 7.711 +/- 0.1383 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201420008 (K2 campaign 1): PARAM radius (solar radii) 7.710994 (16th-84th percentiles 7.598982-7.875484), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7325 +/- 0.0326 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201420008 (K2 campaign 1): PARAM mass (solar masses) 0.73246 (16th-84th percentiles 0.708515-0.773747), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,865 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201420008: APOGEE DR17 effective temperature 4864.816 +/- 50 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,865 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,865 K and log g 2.53 (u1 0.665, u2 0.121): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
