# EPIC 246207330

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.01 solar masses and 11.2 solar radii; APOGEE spectra give 4,754 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2446246731367089152, distance 3,160 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246207330 (K2 campaign 12): PARAM asteroseismic distance (pc) 3159.960938 (16th-84th percentiles 3046.40625-3264.140625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.321 ± 0.020 mas (16.0 standard errors), is not used. Radius 11.2284 +/- 0.5271 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246207330 (K2 campaign 12): PARAM radius (solar radii) 11.228428 (16th-84th percentiles 10.673939-11.728181), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0146 +/- 0.1114 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246207330 (K2 campaign 12): PARAM mass (solar masses) 1.014635 (16th-84th percentiles 0.896393-1.119128), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,754 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246207330: APOGEE DR17 effective temperature 4753.7197 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,754 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,754 K and log g 2.34 (u1 0.695, u2 0.099): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
