# EPIC 213761121

## Sources

Its oscillations, recorded in K2 campaign 7, give 0.85 solar masses and 10.3 solar radii; APOGEE spectra give 4,606 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6759585183044718720, distance 3,746 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213761121 (K2 campaign 7): PARAM asteroseismic distance (pc) 3745.820312 (16th-84th percentiles 3670-3845.507812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.215 ± 0.017 mas (12.7 standard errors), is not used. Radius 10.2578 +/- 0.312 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213761121 (K2 campaign 7): PARAM radius (solar radii) 10.257801 (16th-84th percentiles 10.008708-10.632702), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8495 +/- 0.06 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213761121 (K2 campaign 7): PARAM mass (solar masses) 0.849495 (16th-84th percentiles 0.803791-0.923737), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,606 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213761121: APOGEE DR17 effective temperature 4606.301 +/- 50 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Color.** A Planck spectrum at 4,606 K, because pARAM fits an extinction A_V = 0.30 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,606 K and log g 2.35 (u1 0.743, u2 0.062): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
