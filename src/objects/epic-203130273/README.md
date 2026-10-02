# EPIC 203130273

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.97 solar masses and 12.6 solar radii; GALAH spectra give 4,412 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6045207464590828800, distance 2,620 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 203130273 (K2 campaign 2): PARAM asteroseismic distance (pc) 2620.429688 (16th-84th percentiles 2504.941406-2752.460938), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.323 ± 0.017 mas (18.7 standard errors), is not used. Radius 12.6484 +/- 0.6614 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 203130273 (K2 campaign 2): PARAM radius (solar radii) 12.64837 (16th-84th percentiles 12.061411-13.384251), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9723 +/- 0.1196 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 203130273 (K2 campaign 2): PARAM mass (solar masses) 0.972332 (16th-84th percentiles 0.870295-1.109405), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,412 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 203130273: GALAH DR3 effective temperature 4412.139 +/- 108 K (the catalogue's final uncertainty). log g 2.22 from the mass and radius.

**Color.** A Planck spectrum at 4,412 K, because pARAM fits an extinction A_V = 1.29 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,412 K and log g 2.22 (u1 0.803, u2 0.014): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
