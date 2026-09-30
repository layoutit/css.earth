# TIC 176872208

## Sources

Its oscillations, recorded by TESS, give 1.00 solar masses and 25.7 solar radii; APOGEE spectra give 4,027 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5262305982463154304, distance 1,427 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 176872208 (observed by TESS): PARAM asteroseismic distance (pc) 1427.363281 (16th-84th percentiles 1395.136719-1464.140625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.614 ± 0.013 mas (46.0 standard errors), is not used. Radius 25.6558 +/- 0.9458 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 176872208 (observed by TESS): PARAM radius (solar radii) 25.65584 (16th-84th percentiles 24.842477-26.734059), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.999 +/- 0.1028 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 176872208 (observed by TESS): PARAM mass (solar masses) 0.998959 (16th-84th percentiles 0.912254-1.117916), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,027 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 176872208: APOGEE DR17 effective temperature 4027.1787 +/- 50 K (the catalogue's final uncertainty). log g 1.62 from the mass and radius.

**Colour.** A Planck spectrum at 4,027 K, because pARAM fits an extinction A_V = 0.51 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffd4a7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,027 K and log g 1.62 (u1 0.924, u2 -0.087): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
