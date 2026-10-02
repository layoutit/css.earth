# EPIC 211305047

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.85 solar masses and 10.3 solar radii; APOGEE spectra give 5,008 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 597693494362688640, distance 4,157 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211305047 (K2 campaign 5): PARAM asteroseismic distance (pc) 4156.992188 (16th-84th percentiles 4086.445312-4238.75), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.177 ± 0.019 mas (9.4 standard errors), is not used. Radius 10.2941 +/- 0.29 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211305047 (K2 campaign 5): PARAM radius (solar radii) 10.294142 (16th-84th percentiles 10.051139-10.631225), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8461 +/- 0.0528 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211305047 (K2 campaign 5): PARAM mass (solar masses) 0.846097 (16th-84th percentiles 0.802361-0.907892), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,008 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211305047: APOGEE DR17 effective temperature 5008.127 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Color.** A Planck spectrum at 5,008 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,008 K and log g 2.34 (u1 0.621, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
