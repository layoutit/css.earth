# EPIC 220662169

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.93 solar masses and 8.8 solar radii; APOGEE spectra give 4,514 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2580292007839184512, distance 1,177 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220662169 (K2 campaign 8): PARAM asteroseismic distance (pc) 1177.148438 (16th-84th percentiles 1153.984375-1205.878906), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 1.054 ± 0.064 mas (16.5 standard errors), is not used. Radius 8.7854 +/- 0.2489 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220662169 (K2 campaign 8): PARAM radius (solar radii) 8.785368 (16th-84th percentiles 8.584496-9.082268), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9251 +/- 0.0622 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220662169 (K2 campaign 8): PARAM mass (solar masses) 0.925061 (16th-84th percentiles 0.876749-1.001142), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,514 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220662169: APOGEE DR17 effective temperature 4513.8916 +/- 50 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 4,514 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,514 K and log g 2.52 (u1 0.776, u2 0.036): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
