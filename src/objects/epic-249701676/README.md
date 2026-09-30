# EPIC 249701676

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.89 solar masses and 7.5 solar radii; GALAH spectra give 4,631 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6260022070664468352, distance 2,869 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249701676 (K2 campaign 15): PARAM asteroseismic distance (pc) 2869.335938 (16th-84th percentiles 2816.5625-2936.640625), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.326 ± 0.021 mas (15.2 standard errors), is not used. Radius 7.5084 +/- 0.2064 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249701676 (K2 campaign 15): PARAM radius (solar radii) 7.508371 (16th-84th percentiles 7.34264-7.755515), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.885 +/- 0.0593 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249701676 (K2 campaign 15): PARAM mass (solar masses) 0.884983 (16th-84th percentiles 0.83965-0.958182), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,631 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249701676: GALAH DR3 effective temperature 4630.879 +/- 121 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Colour.** A Planck spectrum at 4,631 K, because pARAM fits an extinction A_V = 0.28 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,631 K and log g 2.63 (u1 0.739, u2 0.064): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
