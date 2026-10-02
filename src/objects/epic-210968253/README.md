# EPIC 210968253

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.83 solar masses and 12.1 solar radii; APOGEE spectra give 4,564 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 52851741538111616, distance 1,720 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210968253 (K2 campaign 4): PARAM asteroseismic distance (pc) 1720.214844 (16th-84th percentiles 1695.722656-1748.75), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.514 ± 0.016 mas (32.9 standard errors), is not used. Radius 12.0749 +/- 0.2674 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210968253 (K2 campaign 4): PARAM radius (solar radii) 12.074913 (16th-84th percentiles 11.856841-12.39162), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8321 +/- 0.0388 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210968253 (K2 campaign 4): PARAM mass (solar masses) 0.832108 (16th-84th percentiles 0.805526-0.883073), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,564 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210968253: APOGEE DR17 effective temperature 4564.4497 +/- 50 K (the catalogue's final uncertainty). log g 2.19 from the mass and radius.

**Color.** A Planck spectrum at 4,564 K, because pARAM fits an extinction A_V = 1.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,564 K and log g 2.19 (u1 0.754, u2 0.054): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
