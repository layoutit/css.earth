# EPIC 228981239

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.97 solar masses and 10.0 solar radii; APOGEE spectra give 4,658 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3683331311298163968, distance 1,836 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228981239 (K2 campaign 10): PARAM asteroseismic distance (pc) 1836.113281 (16th-84th percentiles 1756.757812-1913.652344), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.592 ± 0.017 mas (35.3 standard errors), is not used. Radius 9.951 +/- 0.4615 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228981239 (K2 campaign 10): PARAM radius (solar radii) 9.950955 (16th-84th percentiles 9.504703-10.427624), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9663 +/- 0.1105 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228981239 (K2 campaign 10): PARAM mass (solar masses) 0.966301 (16th-84th percentiles 0.862075-1.083152), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,658 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228981239: APOGEE DR17 effective temperature 4658.462 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,658 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,658 K and log g 2.43 (u1 0.728, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
