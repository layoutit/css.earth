# TIC 141866112

## Sources

Its oscillations, recorded by TESS, give 1.19 solar masses and 13.1 solar radii; APOGEE spectra give 4,504 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5260601494626129280, distance 1,106 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 141866112 (observed by TESS): PARAM asteroseismic distance (pc) 1106.103516 (16th-84th percentiles 1085.869141-1126.689453), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.831 ± 0.017 mas (48.9 standard errors), is not used. Radius 13.0572 +/- 0.3726 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 141866112 (observed by TESS): PARAM radius (solar radii) 13.057248 (16th-84th percentiles 12.688544-13.433729), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.188 +/- 0.0971 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 141866112 (observed by TESS): PARAM mass (solar masses) 1.18801 (16th-84th percentiles 1.093711-1.287973), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,504 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 141866112: APOGEE DR17 effective temperature 4504.0317 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Colour.** A Planck spectrum at 4,504 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,504 K and log g 2.28 (u1 0.775, u2 0.038): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
