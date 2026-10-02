# EPIC 205954223

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.89 solar masses and 6.7 solar radii; APOGEE spectra give 4,696 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2598674742743880960, distance 1,602 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205954223 (K2 campaign 3): PARAM asteroseismic distance (pc) 1601.738281 (16th-84th percentiles 1565.722656-1642.734375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.465 ± 0.015 mas (30.3 standard errors), is not used. Radius 6.6686 +/- 0.1877 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205954223 (K2 campaign 3): PARAM radius (solar radii) 6.668586 (16th-84th percentiles 6.504657-6.879983), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8894 +/- 0.062 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205954223 (K2 campaign 3): PARAM mass (solar masses) 0.889362 (16th-84th percentiles 0.835982-0.95999), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,696 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205954223: APOGEE DR17 effective temperature 4695.5464 +/- 50 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Color.** A Planck spectrum at 4,696 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,696 K and log g 2.74 (u1 0.720, u2 0.079): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
