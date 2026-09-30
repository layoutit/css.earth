# EPIC 205978578

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.88 solar masses and 8.2 solar radii; APOGEE spectra give 4,533 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2596157582670976768, distance 2,181 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205978578 (K2 campaign 3): PARAM asteroseismic distance (pc) 2180.46875 (16th-84th percentiles 2149.6875-2217.050781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.407 ± 0.017 mas (23.4 standard errors), is not used. Radius 8.2231 +/- 0.1665 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205978578 (K2 campaign 3): PARAM radius (solar radii) 8.223081 (16th-84th percentiles 8.09295-8.425951), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8773 +/- 0.0399 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205978578 (K2 campaign 3): PARAM mass (solar masses) 0.877256 (16th-84th percentiles 0.849774-0.929607), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,533 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205978578: APOGEE DR17 effective temperature 4532.5864 +/- 50 K (the catalogue's final uncertainty). log g 2.55 from the mass and radius.

**Colour.** A Planck spectrum at 4,533 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,533 K and log g 2.55 (u1 0.770, u2 0.040): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
