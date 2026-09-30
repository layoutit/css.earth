# EPIC 248677207

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.91 solar masses and 6.2 solar radii; APOGEE spectra give 5,151 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3868697637323017472, distance 3,960 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248677207 (K2 campaign 14): PARAM asteroseismic distance (pc) 3959.453125 (16th-84th percentiles 3838.007812-4085.390625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.209 ± 0.025 mas (8.3 standard errors), is not used. Radius 6.2042 +/- 0.2337 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248677207 (K2 campaign 14): PARAM radius (solar radii) 6.204248 (16th-84th percentiles 5.974101-6.44151), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9118 +/- 0.0848 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248677207 (K2 campaign 14): PARAM mass (solar masses) 0.911787 (16th-84th percentiles 0.830006-0.99951), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,151 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248677207: APOGEE DR17 effective temperature 5150.8223 +/- 118 K (the catalogue's final uncertainty). log g 2.81 from the mass and radius.

**Colour.** A Planck spectrum at 5,151 K, because pARAM fits an extinction A_V = -0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,151 K and log g 2.81 (u1 0.587, u2 0.177): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
