# EPIC 212486691

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.81 solar masses and 11.7 solar radii; APOGEE spectra give 4,781 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3610066801386202240, distance 3,993 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212486691 (K2 campaign 17): PARAM asteroseismic distance (pc) 3993.320312 (16th-84th percentiles 3941.992188-4049.882812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.227 ± 0.017 mas (13.3 standard errors), is not used. Radius 11.6749 +/- 0.2034 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212486691 (K2 campaign 17): PARAM radius (solar radii) 11.674905 (16th-84th percentiles 11.499478-11.906326), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8141 +/- 0.0303 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212486691 (K2 campaign 17): PARAM mass (solar masses) 0.814088 (16th-84th percentiles 0.792668-0.8532), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,781 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212486691: APOGEE DR17 effective temperature 4781.3086 +/- 50 K (the catalogue's final uncertainty). log g 2.21 from the mass and radius.

**Color.** A Planck spectrum at 4,781 K, because pARAM fits an extinction A_V = 0.28 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,781 K and log g 2.21 (u1 0.686, u2 0.106): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
