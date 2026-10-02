# EPIC 235288951

## Sources

Its oscillations, recorded in K2 campaign 11, give 1.96 solar masses and 18.8 solar radii; APOGEE spectra give 4,670 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4111597927909174528, distance 3,683 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 235288951 (K2 campaign 11): PARAM asteroseismic distance (pc) 3683.398438 (16th-84th percentiles 3590.273438-3776.523438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.426 ± 0.020 mas (20.9 standard errors), is not used. Radius 18.7778 +/- 0.7431 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 235288951 (K2 campaign 11): PARAM radius (solar radii) 18.777835 (16th-84th percentiles 17.927482-19.413718), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9596 +/- 0.1654 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 235288951 (K2 campaign 11): PARAM mass (solar masses) 1.959612 (16th-84th percentiles 1.774823-2.105614), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,670 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 235288951: APOGEE DR17 effective temperature 4670.3555 +/- 50 K (the catalogue's final uncertainty). log g 2.18 from the mass and radius.

**Color.** A Planck spectrum at 4,670 K, because pARAM fits an extinction A_V = 1.55 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,670 K and log g 2.18 (u1 0.720, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
