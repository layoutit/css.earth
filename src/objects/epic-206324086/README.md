# EPIC 206324086

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.57 solar masses and 15.1 solar radii; APOGEE spectra give 5,092 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2621515516263025792, distance 6,990 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206324086 (K2 campaign 3): PARAM asteroseismic distance (pc) 6989.453125 (16th-84th percentiles 6723.59375-7206.25), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.169 ± 0.019 mas (9.1 standard errors), is not used. Radius 15.0848 +/- 0.9965 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206324086 (K2 campaign 3): PARAM radius (solar radii) 15.08479 (16th-84th percentiles 14.257557-16.250601), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5714 +/- 0.2395 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206324086 (K2 campaign 3): PARAM mass (solar masses) 1.571413 (16th-84th percentiles 1.394-1.873021), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,092 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206324086: APOGEE DR17 effective temperature 5092.3887 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Color.** A Planck spectrum at 5,092 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,092 K and log g 2.28 (u1 0.598, u2 0.168): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
