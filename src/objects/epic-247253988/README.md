# EPIC 247253988

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.28 solar masses and 16.7 solar radii; GALAH spectra give 4,482 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3410972733387263744, distance 3,767 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247253988 (K2 campaign 13): PARAM asteroseismic distance (pc) 3766.484375 (16th-84th percentiles 3552.03125-4113.789062), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.282 ± 0.016 mas (17.9 standard errors), is not used. Radius 16.7205 +/- 1.2363 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247253988 (K2 campaign 13): PARAM radius (solar radii) 16.720511 (16th-84th percentiles 15.597668-18.070316), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2777 +/- 0.2164 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247253988 (K2 campaign 13): PARAM mass (solar masses) 1.27774 (16th-84th percentiles 1.090216-1.523086), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,482 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247253988: GALAH DR3 effective temperature 4482.1885 +/- 142 K (the catalogue's final uncertainty). log g 2.1 from the mass and radius.

**Color.** A Planck spectrum at 4,482 K, because pARAM fits an extinction A_V = 1.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,482 K and log g 2.1 (u1 0.778, u2 0.035): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
