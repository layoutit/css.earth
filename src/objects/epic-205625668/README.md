# EPIC 205625668

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.88 solar masses and 10.8 solar radii; GALAH spectra give 4,636 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4325098248226483712, distance 2,241 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205625668 (K2 campaign 2): PARAM asteroseismic distance (pc) 2240.800781 (16th-84th percentiles 2190.9375-2315.253906), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.417 ± 0.015 mas (27.4 standard errors), is not used. Radius 10.8416 +/- 0.4853 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205625668 (K2 campaign 2): PARAM radius (solar radii) 10.841571 (16th-84th percentiles 10.47751-11.448148), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8802 +/- 0.0876 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205625668 (K2 campaign 2): PARAM mass (solar masses) 0.880232 (16th-84th percentiles 0.816888-0.99199), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,636 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205625668: GALAH DR3 effective temperature 4636.3887 +/- 131 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Colour.** A Planck spectrum at 4,636 K, because pARAM fits an extinction A_V = 0.77 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,636 K and log g 2.31 (u1 0.733, u2 0.070): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
