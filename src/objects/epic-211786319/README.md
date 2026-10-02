# EPIC 211786319

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.90 solar masses and 12.1 solar radii; GALAH spectra give 4,870 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 659078816225847296, distance 4,246 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211786319 (K2 campaign 5): PARAM asteroseismic distance (pc) 4245.78125 (16th-84th percentiles 4144.570312-4342.421875), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.194 ± 0.018 mas (10.6 standard errors), is not used. Radius 12.0942 +/- 0.4863 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211786319 (K2 campaign 5): PARAM radius (solar radii) 12.094216 (16th-84th percentiles 11.619733-12.592248), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8975 +/- 0.0815 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211786319 (K2 campaign 5): PARAM mass (solar masses) 0.8975 (16th-84th percentiles 0.81867-0.981584), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,870 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211786319: GALAH DR3 effective temperature 4870.208 +/- 116 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Color.** A Planck spectrum at 4,870 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,870 K and log g 2.23 (u1 0.660, u2 0.125): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
