# EPIC 212107152

## Sources

Its oscillations, recorded in K2 campaign 18, give 2.16 solar masses and 10.1 solar radii; APOGEE spectra give 5,118 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 665224227231320960, distance 1,045 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212107152 (K2 campaign 18): PARAM asteroseismic distance (pc) 1044.472656 (16th-84th percentiles 1014.746094-1075.332031), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.841 ± 0.032 mas (26.4 standard errors), is not used. Radius 10.0816 +/- 0.3608 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212107152 (K2 campaign 18): PARAM radius (solar radii) 10.081585 (16th-84th percentiles 9.745256-10.466926), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.1573 +/- 0.1788 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212107152 (K2 campaign 18): PARAM mass (solar masses) 2.157277 (16th-84th percentiles 1.992621-2.350205), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,118 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212107152: APOGEE DR17 effective temperature 5118.339 +/- 50 K (the catalogue's final uncertainty). log g 2.76 from the mass and radius.

**Color.** A Planck spectrum at 5,118 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,118 K and log g 2.76 (u1 0.595, u2 0.171): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
