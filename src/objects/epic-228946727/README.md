# EPIC 228946727

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.83 solar masses and 7.2 solar radii; APOGEE spectra give 5,024 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3682958718591170560, distance 3,050 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228946727 (K2 campaign 10): PARAM asteroseismic distance (pc) 3050.234375 (16th-84th percentiles 2963.28125-3133.4375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.313 ± 0.016 mas (19.6 standard errors), is not used. Radius 7.2442 +/- 0.2543 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228946727 (K2 campaign 10): PARAM radius (solar radii) 7.244238 (16th-84th percentiles 6.985045-7.493737), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8293 +/- 0.0704 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228946727 (K2 campaign 10): PARAM mass (solar masses) 0.829299 (16th-84th percentiles 0.758582-0.899409), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,024 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228946727: APOGEE DR17 effective temperature 5023.912 +/- 50 K (the catalogue's final uncertainty). log g 2.64 from the mass and radius.

**Colour.** A Planck spectrum at 5,024 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,024 K and log g 2.64 (u1 0.620, u2 0.154): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
