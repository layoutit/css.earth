# EPIC 201207854

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.98 solar masses and 12.0 solar radii; APOGEE spectra give 4,576 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3600365879014013440, distance 7,779 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201207854 (K2 campaign 1): PARAM asteroseismic distance (pc) 7778.515625 (16th-84th percentiles 7476.171875-8098.75), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.140 ± 0.034 mas (4.1 standard errors), is not used. Radius 11.9788 +/- 0.5684 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201207854 (K2 campaign 1): PARAM radius (solar radii) 11.978808 (16th-84th percentiles 11.447291-12.584121), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9815 +/- 0.1221 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201207854 (K2 campaign 1): PARAM mass (solar masses) 0.981451 (16th-84th percentiles 0.87156-1.115825), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,576 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201207854: APOGEE DR17 effective temperature 4576.335 +/- 66 K (the catalogue's final uncertainty). log g 2.27 from the mass and radius.

**Colour.** A Planck spectrum at 4,576 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,576 K and log g 2.27 (u1 0.751, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
