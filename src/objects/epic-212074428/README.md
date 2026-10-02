# EPIC 212074428

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.96 solar masses and 10.1 solar radii; APOGEE spectra give 4,996 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 685211939874804224, distance 3,153 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212074428 (K2 campaign 16): PARAM asteroseismic distance (pc) 3153.007812 (16th-84th percentiles 3096.601562-3219.296875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.034 ± 0.069 mas (0.5 standard errors), is not used. Radius 10.092 +/- 0.273 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212074428 (K2 campaign 16): PARAM radius (solar radii) 10.092026 (16th-84th percentiles 9.812451-10.358513), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9563 +/- 0.0599 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212074428 (K2 campaign 16): PARAM mass (solar masses) 0.956266 (16th-84th percentiles 0.899161-1.018881), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,996 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212074428: APOGEE DR17 effective temperature 4995.7974 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Color.** A Planck spectrum at 4,996 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,996 K and log g 2.41 (u1 0.625, u2 0.151): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
