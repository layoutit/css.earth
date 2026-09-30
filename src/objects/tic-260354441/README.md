# TIC 260354441

## Sources

Its oscillations, recorded by TESS, give 1.29 solar masses and 11.6 solar radii; APOGEE spectra give 4,926 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5496472066206657664, distance 1,314 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 260354441 (observed by TESS): PARAM asteroseismic distance (pc) 1313.496094 (16th-84th percentiles 1296.992188-1338.632812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.763 ± 0.012 mas (66.1 standard errors), is not used. Radius 11.621 +/- 0.2484 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 260354441 (observed by TESS): PARAM radius (solar radii) 11.620993 (16th-84th percentiles 11.438967-11.935792), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2932 +/- 0.0772 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 260354441 (observed by TESS): PARAM mass (solar masses) 1.293179 (16th-84th percentiles 1.232148-1.386611), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,926 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 260354441: APOGEE DR17 effective temperature 4925.7773 +/- 50 K (the catalogue's final uncertainty). log g 2.42 from the mass and radius.

**Colour.** A Planck spectrum at 4,926 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,926 K and log g 2.42 (u1 0.645, u2 0.135): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
