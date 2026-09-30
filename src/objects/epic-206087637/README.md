# EPIC 206087637

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.74 solar masses and 15.3 solar radii; APOGEE spectra give 4,788 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6840942648287565184, distance 2,986 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206087637 (K2 campaign 3): PARAM asteroseismic distance (pc) 2986.40625 (16th-84th percentiles 2875.9375-3080), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.341 ± 0.016 mas (20.8 standard errors), is not used. Radius 15.2804 +/- 0.909 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206087637 (K2 campaign 3): PARAM radius (solar radii) 15.280387 (16th-84th percentiles 14.361596-16.179556), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.737 +/- 0.2267 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206087637 (K2 campaign 3): PARAM mass (solar masses) 1.737012 (16th-84th percentiles 1.504594-1.958054), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,788 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206087637: APOGEE DR17 effective temperature 4787.594 +/- 50 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Colour.** A Planck spectrum at 4,788 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,788 K and log g 2.31 (u1 0.685, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
