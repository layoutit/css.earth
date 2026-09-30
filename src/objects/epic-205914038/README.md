# EPIC 205914038

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.80 solar masses and 10.6 solar radii; APOGEE spectra give 4,940 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6825813132067001984, distance 4,253 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205914038 (K2 campaign 3): PARAM asteroseismic distance (pc) 4253.398438 (16th-84th percentiles 4112.65625-4433.4375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.208 ± 0.018 mas (11.8 standard errors), is not used. Radius 10.5878 +/- 0.4671 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205914038 (K2 campaign 3): PARAM radius (solar radii) 10.587769 (16th-84th percentiles 10.186499-11.120739), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8005 +/- 0.0861 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205914038 (K2 campaign 3): PARAM mass (solar masses) 0.800535 (16th-84th percentiles 0.727642-0.899915), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,940 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205914038: APOGEE DR17 effective temperature 4939.507000000001 +/- 50 K (the catalogue's final uncertainty). log g 2.29 from the mass and radius.

**Colour.** A Planck spectrum at 4,940 K, because pARAM fits an extinction A_V = -0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,940 K and log g 2.29 (u1 0.640, u2 0.139): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
