# EPIC 220465040

## Sources

Its oscillations, recorded in K2 campaign 8, give 2.01 solar masses and 9.0 solar radii; APOGEE spectra give 5,157 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2564604279013251072, distance 4,431 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220465040 (K2 campaign 8): PARAM asteroseismic distance (pc) 4430.625 (16th-84th percentiles 4365.859375-4501.757812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.204 ± 0.018 mas (11.2 standard errors), is not used. Radius 8.987 +/- 0.1499 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220465040 (K2 campaign 8): PARAM radius (solar radii) 8.987015 (16th-84th percentiles 8.865155-9.164968), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.0086 +/- 0.0748 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220465040 (K2 campaign 8): PARAM mass (solar masses) 2.008563 (16th-84th percentiles 1.952992-2.102594), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,157 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220465040: APOGEE DR17 effective temperature 5156.807 +/- 50 K (the catalogue's final uncertainty). log g 2.83 from the mass and radius.

**Color.** A Planck spectrum at 5,157 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,157 K and log g 2.83 (u1 0.585, u2 0.178): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
