# EPIC 201892421

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.03 solar masses and 5.5 solar radii; APOGEE spectra give 4,909 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3910614353468592384, distance 2,696 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201892421 (K2 campaign 1): PARAM asteroseismic distance (pc) 2695.625 (16th-84th percentiles 2615.976562-2775.898438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.362 ± 0.018 mas (20.1 standard errors), is not used. Radius 5.5265 +/- 0.2013 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201892421 (K2 campaign 1): PARAM radius (solar radii) 5.526499 (16th-84th percentiles 5.328846-5.731419), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0259 +/- 0.0941 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201892421 (K2 campaign 1): PARAM mass (solar masses) 1.025912 (16th-84th percentiles 0.935838-1.123971), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,909 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201892421: APOGEE DR17 effective temperature 4908.682 +/- 50 K (the catalogue's final uncertainty). log g 2.96 from the mass and radius.

**Colour.** A Planck spectrum at 4,909 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,909 K and log g 2.96 (u1 0.658, u2 0.125): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
