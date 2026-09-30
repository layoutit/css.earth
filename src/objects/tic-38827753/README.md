# TIC 38827753

## Sources

Its oscillations, recorded by TESS, give 0.83 solar masses and 20.8 solar radii; APOGEE spectra give 4,276 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4677473823502914944, distance 1,727 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38827753 (observed by TESS): PARAM asteroseismic distance (pc) 1726.816406 (16th-84th percentiles 1710.507812-1745.917969), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.506 ± 0.010 mas (49.9 standard errors), is not used. Radius 20.8251 +/- 0.3857 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38827753 (observed by TESS): PARAM radius (solar radii) 20.825053 (16th-84th percentiles 20.541542-21.312897), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8331 +/- 0.0431 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38827753 (observed by TESS): PARAM mass (solar masses) 0.833129 (16th-84th percentiles 0.802939-0.889053), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,276 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38827753: APOGEE DR17 effective temperature 4275.874 +/- 50 K (the catalogue's final uncertainty). log g 1.72 from the mass and radius.

**Colour.** A Planck spectrum at 4,276 K, because pARAM fits an extinction A_V = 0.32 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffd9b2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,276 K and log g 1.72 (u1 0.844, u2 -0.018): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
