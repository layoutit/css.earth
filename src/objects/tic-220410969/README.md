# TIC 220410969

## Sources

Its oscillations, recorded by TESS, give 0.84 solar masses and 17.1 solar radii; APOGEE spectra give 4,477 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4774293411534804224, distance 1,303 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220410969 (observed by TESS): PARAM asteroseismic distance (pc) 1302.734375 (16th-84th percentiles 1289.355469-1316.796875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.660 ± 0.014 mas (46.7 standard errors), is not used. Radius 17.1178 +/- 0.3983 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220410969 (observed by TESS): PARAM radius (solar radii) 17.117822 (16th-84th percentiles 16.676976-17.473476), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8372 +/- 0.0379 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220410969 (observed by TESS): PARAM mass (solar masses) 0.837197 (16th-84th percentiles 0.811588-0.887347), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,477 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220410969: APOGEE DR17 effective temperature 4477.371 +/- 50 K (the catalogue's final uncertainty). log g 1.89 from the mass and radius.

**Color.** A Planck spectrum at 4,477 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,477 K and log g 1.89 (u1 0.777, u2 0.037): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
