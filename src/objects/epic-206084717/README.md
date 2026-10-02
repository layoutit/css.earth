# EPIC 206084717

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.88 solar masses and 9.7 solar radii; APOGEE spectra give 4,602 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2613500798051229696, distance 1,660 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206084717 (K2 campaign 3): PARAM asteroseismic distance (pc) 1659.511719 (16th-84th percentiles 1623.359375-1705), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.550 ± 0.019 mas (29.2 standard errors), is not used. Radius 9.7093 +/- 0.3207 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206084717 (K2 campaign 3): PARAM radius (solar radii) 9.709288 (16th-84th percentiles 9.447327-10.088766), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8838 +/- 0.0687 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206084717 (K2 campaign 3): PARAM mass (solar masses) 0.883768 (16th-84th percentiles 0.830257-0.967566), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,602 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206084717: APOGEE DR17 effective temperature 4602.286 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Color.** A Planck spectrum at 4,602 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,602 K and log g 2.41 (u1 0.745, u2 0.060): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
