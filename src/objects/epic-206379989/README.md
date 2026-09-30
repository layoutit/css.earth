# EPIC 206379989

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.83 solar masses and 13.0 solar radii; APOGEE spectra give 4,685 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2622650452781325056, distance 4,063 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206379989 (K2 campaign 3): PARAM asteroseismic distance (pc) 4062.539062 (16th-84th percentiles 3933.085938-4229.0625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.227 ± 0.018 mas (12.4 standard errors), is not used. Radius 12.9531 +/- 0.584 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206379989 (K2 campaign 3): PARAM radius (solar radii) 12.953128 (16th-84th percentiles 12.4667-13.634726), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8345 +/- 0.0873 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206379989 (K2 campaign 3): PARAM mass (solar masses) 0.834534 (16th-84th percentiles 0.764238-0.938812), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,685 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206379989: APOGEE DR17 effective temperature 4685.258 +/- 50 K (the catalogue's final uncertainty). log g 2.13 from the mass and radius.

**Colour.** A Planck spectrum at 4,685 K, because pARAM fits an extinction A_V = 0.26 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,685 K and log g 2.13 (u1 0.715, u2 0.084): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
