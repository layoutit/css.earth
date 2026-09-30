# EPIC 220595258

## Sources

Its oscillations, recorded in K2 campaign 8, give 1.23 solar masses and 11.1 solar radii; APOGEE spectra give 4,968 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2750053579510985344, distance 1,008 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220595258 (K2 campaign 8): PARAM asteroseismic distance (pc) 1007.763672 (16th-84th percentiles 918.037109-1059.052734), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 1.038 ± 0.021 mas (48.4 standard errors), is not used. Radius 11.0644 +/- 0.6923 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220595258 (K2 campaign 8): PARAM radius (solar radii) 11.064362 (16th-84th percentiles 10.382709-11.76727), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2348 +/- 0.1806 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220595258 (K2 campaign 8): PARAM mass (solar masses) 1.234762 (16th-84th percentiles 1.066742-1.427878), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,968 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220595258: APOGEE DR17 effective temperature 4967.6343 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 4,968 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,968 K and log g 2.44 (u1 0.633, u2 0.144): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
