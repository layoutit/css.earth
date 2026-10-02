# EPIC 228964196

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.83 solar masses and 6.4 solar radii; APOGEE spectra give 4,902 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3683260156575830272, distance 3,046 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228964196 (K2 campaign 10): PARAM asteroseismic distance (pc) 3045.898438 (16th-84th percentiles 2966.640625-3135.351562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.328 ± 0.019 mas (16.9 standard errors), is not used. Radius 6.3728 +/- 0.2063 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228964196 (K2 campaign 10): PARAM radius (solar radii) 6.372829 (16th-84th percentiles 6.190352-6.602987), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8348 +/- 0.065 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228964196 (K2 campaign 10): PARAM mass (solar masses) 0.834834 (16th-84th percentiles 0.778781-0.90872), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,902 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228964196: APOGEE DR17 effective temperature 4901.5723 +/- 50 K (the catalogue's final uncertainty). log g 2.75 from the mass and radius.

**Color.** A Planck spectrum at 4,902 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,902 K and log g 2.75 (u1 0.657, u2 0.126): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
