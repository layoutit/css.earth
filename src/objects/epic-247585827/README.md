# EPIC 247585827

## Sources

Its oscillations, recorded in K2 campaign 13, give 2.12 solar masses and 9.9 solar radii; APOGEE spectra give 4,991 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418299157321298304, distance 2,739 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247585827 (K2 campaign 13): PARAM asteroseismic distance (pc) 2739.179688 (16th-84th percentiles 2640.742188-2803.320312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.315 ± 0.017 mas (18.4 standard errors), is not used. Radius 9.9194 +/- 0.3311 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247585827 (K2 campaign 13): PARAM radius (solar radii) 9.919376 (16th-84th percentiles 9.568649-10.230846), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.1218 +/- 0.1663 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247585827 (K2 campaign 13): PARAM mass (solar masses) 2.121786 (16th-84th percentiles 1.949991-2.282525), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,991 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247585827: APOGEE DR17 effective temperature 4990.6016 +/- 50 K (the catalogue's final uncertainty). log g 2.77 from the mass and radius.

**Colour.** A Planck spectrum at 4,991 K, because pARAM fits an extinction A_V = 1.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,991 K and log g 2.77 (u1 0.631, u2 0.146): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
