# EPIC 228795694

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.09 solar masses and 7.4 solar radii; APOGEE spectra give 4,760 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3676645116665966080, distance 2,956 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228795694 (K2 campaign 10): PARAM asteroseismic distance (pc) 2955.820312 (16th-84th percentiles 2874.21875-3040.273438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.307 ± 0.018 mas (17.5 standard errors), is not used. Radius 7.3884 +/- 0.2604 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228795694 (K2 campaign 10): PARAM radius (solar radii) 7.388402 (16th-84th percentiles 7.134396-7.655159), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0941 +/- 0.0934 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228795694 (K2 campaign 10): PARAM mass (solar masses) 1.094112 (16th-84th percentiles 1.005525-1.19235), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,760 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228795694: APOGEE DR17 effective temperature 4759.981 +/- 50 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Color.** A Planck spectrum at 4,760 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,760 K and log g 2.74 (u1 0.700, u2 0.095): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
