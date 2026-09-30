# EPIC 211798652

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.45 solar masses and 10.9 solar radii; GALAH spectra give 4,811 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 658532049708438784, distance 2,898 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211798652 (K2 campaign 5): PARAM asteroseismic distance (pc) 2897.460938 (16th-84th percentiles 2816.484375-3040.859375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.339 ± 0.017 mas (20.4 standard errors), is not used. Radius 10.8591 +/- 0.5735 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211798652 (K2 campaign 5): PARAM radius (solar radii) 10.859132 (16th-84th percentiles 10.385443-11.532371), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4471 +/- 0.1735 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211798652 (K2 campaign 5): PARAM mass (solar masses) 1.447111 (16th-84th percentiles 1.307978-1.655064), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,811 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211798652: GALAH DR3 effective temperature 4810.688 +/- 163 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,811 K, because pARAM fits an extinction A_V = 0.23 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,811 K and log g 2.53 (u1 0.681, u2 0.109): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
