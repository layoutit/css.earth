# EPIC 211466513

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.21 solar masses and 10.1 solar radii; APOGEE spectra give 4,845 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604514623983250432, distance 3,425 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211466513 (K2 campaign 5): PARAM asteroseismic distance (pc) 3425.15625 (16th-84th percentiles 3368.75-3475.273438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.245 ± 0.023 mas (10.7 standard errors), is not used. Radius 10.14 +/- 0.693 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211466513 (K2 campaign 5): PARAM radius (solar radii) 10.14 (16th-84th percentiles 9.333965-10.719988), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2132 +/- 0.1865 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211466513 (K2 campaign 5): PARAM mass (solar masses) 1.213155 (16th-84th percentiles 0.994464-1.367519), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,845 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211466513: APOGEE DR17 effective temperature 4844.8647 +/- 84 K (the catalogue's final uncertainty). log g 2.51 from the mass and radius.

**Colour.** A Planck spectrum at 4,845 K, because pARAM fits an extinction A_V = 0.33 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,845 K and log g 2.51 (u1 0.670, u2 0.117): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
