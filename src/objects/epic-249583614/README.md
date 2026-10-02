# EPIC 249583614

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.80 solar masses and 13.3 solar radii; GALAH spectra give 4,734 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6241758396551628160, distance 5,997 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249583614 (K2 campaign 15): PARAM asteroseismic distance (pc) 5997.265625 (16th-84th percentiles 5794.0625-6230.78125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.114 ± 0.026 mas (4.5 standard errors), is not used. Radius 13.2501 +/- 0.6115 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249583614 (K2 campaign 15): PARAM radius (solar radii) 13.250069 (16th-84th percentiles 12.720844-13.943873), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7997 +/- 0.0864 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249583614 (K2 campaign 15): PARAM mass (solar masses) 0.799745 (16th-84th percentiles 0.725429-0.89826), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,734 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249583614: GALAH DR3 effective temperature 4734.411 +/- 172 K (the catalogue's final uncertainty). log g 2.1 from the mass and radius.

**Color.** A Planck spectrum at 4,734 K, because pARAM fits an extinction A_V = 0.39 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,734 K and log g 2.1 (u1 0.699, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
