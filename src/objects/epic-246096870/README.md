# EPIC 246096870

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.96 solar masses and 11.3 solar radii; APOGEE spectra give 4,867 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2440188314922584576, distance 3,345 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246096870 (K2 campaign 12): PARAM asteroseismic distance (pc) 3344.492188 (16th-84th percentiles 3176.640625-3511.992188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.377 ± 0.022 mas (17.0 standard errors), is not used. Radius 11.3108 +/- 0.6307 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246096870 (K2 campaign 12): PARAM radius (solar radii) 11.310789 (16th-84th percentiles 10.668889-11.930286), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9584 +/- 0.1163 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246096870 (K2 campaign 12): PARAM mass (solar masses) 0.958413 (16th-84th percentiles 0.840847-1.073442), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,867 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246096870: APOGEE DR17 effective temperature 4867.2114 +/- 50 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Colour.** A Planck spectrum at 4,867 K, because pARAM fits an extinction A_V = -0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,867 K and log g 2.31 (u1 0.662, u2 0.123): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
