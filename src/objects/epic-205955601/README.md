# EPIC 205955601

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.77 solar masses and 12.3 solar radii; APOGEE spectra give 4,826 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2596392392827572096, distance 4,692 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205955601 (K2 campaign 3): PARAM asteroseismic distance (pc) 4691.953125 (16th-84th percentiles 4588.632812-4832.34375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.146 ± 0.019 mas (7.8 standard errors), is not used. Radius 12.3347 +/- 0.532 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205955601 (K2 campaign 3): PARAM radius (solar radii) 12.334656 (16th-84th percentiles 11.950754-13.014692), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7727 +/- 0.0788 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205955601 (K2 campaign 3): PARAM mass (solar masses) 0.772726 (16th-84th percentiles 0.719784-0.877349), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,826 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205955601: APOGEE DR17 effective temperature 4825.9424 +/- 50 K (the catalogue's final uncertainty). log g 2.14 from the mass and radius.

**Color.** A Planck spectrum at 4,826 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,826 K and log g 2.14 (u1 0.672, u2 0.116): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
