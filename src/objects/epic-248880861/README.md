# EPIC 248880861

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.05 solar masses and 7.9 solar radii; APOGEE spectra give 5,111 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3883194732494965376, distance 4,170 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248880861 (K2 campaign 14): PARAM asteroseismic distance (pc) 4169.804688 (16th-84th percentiles 4034.765625-4310.507812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.245 ± 0.020 mas (12.0 standard errors), is not used. Radius 7.8653 +/- 0.3392 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248880861 (K2 campaign 14): PARAM radius (solar radii) 7.865267 (16th-84th percentiles 7.53567-8.214065), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0535 +/- 0.1065 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248880861 (K2 campaign 14): PARAM mass (solar masses) 1.053477 (16th-84th percentiles 0.95356-1.166653), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,111 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248880861: APOGEE DR17 effective temperature 5111.1626 +/- 51 K (the catalogue's final uncertainty). log g 2.67 from the mass and radius.

**Colour.** A Planck spectrum at 5,111 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,111 K and log g 2.67 (u1 0.596, u2 0.170): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
