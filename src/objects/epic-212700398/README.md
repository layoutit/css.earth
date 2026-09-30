# EPIC 212700398

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.99 solar masses and 24.0 solar radii; APOGEE spectra give 4,780 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3625259784339193472, distance 8,976 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212700398 (K2 campaign 17): PARAM asteroseismic distance (pc) 8975.46875 (16th-84th percentiles 8396.796875-9590.234375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.126 ± 0.019 mas (6.5 standard errors), is not used. Radius 24.0151 +/- 2.2237 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212700398 (K2 campaign 17): PARAM radius (solar radii) 24.01509 (16th-84th percentiles 21.988393-26.435756), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9949 +/- 0.2 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212700398 (K2 campaign 17): PARAM mass (solar masses) 0.994863 (16th-84th percentiles 0.823003-1.223079), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,780 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212700398: APOGEE DR17 effective temperature 4779.5454 +/- 50 K (the catalogue's final uncertainty). log g 1.67 from the mass and radius.

**Colour.** A Planck spectrum at 4,780 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,780 K and log g 1.67 (u1 0.682, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
