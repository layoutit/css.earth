# EPIC 211480777

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 19.0 solar radii; APOGEE spectra give 4,753 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 602285256783119616, distance 7,148 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211480777 (K2 campaign 5): PARAM asteroseismic distance (pc) 7147.5 (16th-84th percentiles 6728.59375-7570.078125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.126 ± 0.021 mas (6.1 standard errors), is not used. Radius 19.0326 +/- 1.4697 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211480777 (K2 campaign 5): PARAM radius (solar radii) 19.032583 (16th-84th percentiles 17.584931-20.524408), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1256 +/- 0.1904 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211480777 (K2 campaign 5): PARAM mass (solar masses) 1.125631 (16th-84th percentiles 0.946929-1.327769), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,753 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211480777: APOGEE DR17 effective temperature 4753.3945 +/- 50 K (the catalogue's final uncertainty). log g 1.93 from the mass and radius.

**Colour.** A Planck spectrum at 4,753 K, because pARAM fits an extinction A_V = 0.29 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,753 K and log g 1.93 (u1 0.691, u2 0.102): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
