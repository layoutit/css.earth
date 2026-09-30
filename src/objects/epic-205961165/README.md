# EPIC 205961165

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.89 solar masses and 16.0 solar radii; APOGEE spectra give 4,861 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2595741795476771200, distance 4,649 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205961165 (K2 campaign 3): PARAM asteroseismic distance (pc) 4648.476562 (16th-84th percentiles 4371.445312-4911.210938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.168 ± 0.022 mas (7.8 standard errors), is not used. Radius 16.0083 +/- 1.0669 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205961165 (K2 campaign 3): PARAM radius (solar radii) 16.008344 (16th-84th percentiles 14.974632-17.108347), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8854 +/- 0.1332 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205961165 (K2 campaign 3): PARAM mass (solar masses) 0.885377 (16th-84th percentiles 0.754537-1.020972), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,861 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205961165: APOGEE DR17 effective temperature 4861.1895 +/- 50 K (the catalogue's final uncertainty). log g 1.98 from the mass and radius.

**Colour.** A Planck spectrum at 4,861 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,861 K and log g 1.98 (u1 0.660, u2 0.124): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
