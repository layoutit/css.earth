# EPIC 211658621

## Sources

Its oscillations, recorded in K2 campaign 16, give 1.05 solar masses and 7.0 solar radii; APOGEE spectra give 4,757 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 657674804300222464, distance 1,555 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211658621 (K2 campaign 16): PARAM asteroseismic distance (pc) 1555.371094 (16th-84th percentiles 1513.339844-1598.105469), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.652 ± 0.017 mas (39.0 standard errors), is not used. Radius 7.0467 +/- 0.2436 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211658621 (K2 campaign 16): PARAM radius (solar radii) 7.046715 (16th-84th percentiles 6.806403-7.2936), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0534 +/- 0.0893 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211658621 (K2 campaign 16): PARAM mass (solar masses) 1.053393 (16th-84th percentiles 0.967461-1.146104), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,757 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211658621: APOGEE DR17 effective temperature 4757.3594 +/- 50 K (the catalogue's final uncertainty). log g 2.76 from the mass and radius.

**Color.** A Planck spectrum at 4,757 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,757 K and log g 2.76 (u1 0.701, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
