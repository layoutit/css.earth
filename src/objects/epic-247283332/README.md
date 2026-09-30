# EPIC 247283332

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.31 solar masses and 23.6 solar radii; GALAH spectra give 4,327 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3401880111526458624, distance 2,242 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247283332 (K2 campaign 13): PARAM asteroseismic distance (pc) 2241.523438 (16th-84th percentiles 2085.761719-2408.085938), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.402 ± 0.018 mas (22.4 standard errors), is not used. Radius 23.6171 +/- 2.2646 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247283332 (K2 campaign 13): PARAM radius (solar radii) 23.617059 (16th-84th percentiles 21.470867-26.000023), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3087 +/- 0.2736 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247283332 (K2 campaign 13): PARAM mass (solar masses) 1.308651 (16th-84th percentiles 1.063828-1.610976), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,327 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247283332: GALAH DR3 effective temperature 4327.291 +/- 100 K (the catalogue's final uncertainty). log g 1.81 from the mass and radius.

**Colour.** A Planck spectrum at 4,327 K, because pARAM fits an extinction A_V = 1.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,327 K and log g 1.81 (u1 0.827, u2 -0.004): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
