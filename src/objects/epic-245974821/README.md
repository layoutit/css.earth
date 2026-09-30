# EPIC 245974821

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.82 solar masses and 16.2 solar radii; APOGEE spectra give 4,572 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2435384170663833088, distance 3,116 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245974821 (K2 campaign 12): PARAM asteroseismic distance (pc) 3116.40625 (16th-84th percentiles 3046.210938-3211.875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.363 ± 0.014 mas (25.6 standard errors), is not used. Radius 16.1561 +/- 0.6608 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245974821 (K2 campaign 12): PARAM radius (solar radii) 16.156102 (16th-84th percentiles 15.644483-16.966055), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8199 +/- 0.074 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245974821 (K2 campaign 12): PARAM mass (solar masses) 0.819918 (16th-84th percentiles 0.766265-0.914287), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,572 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245974821: APOGEE DR17 effective temperature 4572.3887 +/- 50 K (the catalogue's final uncertainty). log g 1.94 from the mass and radius.

**Colour.** A Planck spectrum at 4,572 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,572 K and log g 1.94 (u1 0.748, u2 0.060): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
