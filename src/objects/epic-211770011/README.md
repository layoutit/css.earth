# EPIC 211770011

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 6.8 solar radii; APOGEE spectra give 4,777 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 656164354498041728, distance 3,577 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211770011 (K2 campaign 5): PARAM asteroseismic distance (pc) 3576.875 (16th-84th percentiles 3479.53125-3677.421875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.251 ± 0.025 mas (10.0 standard errors), is not used. Radius 6.842 +/- 0.2384 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211770011 (K2 campaign 5): PARAM radius (solar radii) 6.842028 (16th-84th percentiles 6.610282-7.086984), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1303 +/- 0.0948 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211770011 (K2 campaign 5): PARAM mass (solar masses) 1.130314 (16th-84th percentiles 1.040434-1.230038), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,777 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211770011: APOGEE DR17 effective temperature 4777.4775 +/- 50 K (the catalogue's final uncertainty). log g 2.82 from the mass and radius.

**Color.** A Planck spectrum at 4,777 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,777 K and log g 2.82 (u1 0.696, u2 0.097): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
