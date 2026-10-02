# EPIC 220185674

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.81 solar masses and 12.5 solar radii; APOGEE spectra give 4,599 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2536005741056976000, distance 4,753 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220185674 (K2 campaign 8): PARAM asteroseismic distance (pc) 4752.734375 (16th-84th percentiles 4665.46875-4860.546875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.191 ± 0.021 mas (9.2 standard errors), is not used. Radius 12.5263 +/- 0.3611 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220185674 (K2 campaign 8): PARAM radius (solar radii) 12.526289 (16th-84th percentiles 12.24533-12.96744), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8087 +/- 0.0513 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220185674 (K2 campaign 8): PARAM mass (solar masses) 0.808695 (16th-84th percentiles 0.772443-0.875104), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,599 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220185674: APOGEE DR17 effective temperature 4599.3604 +/- 50 K (the catalogue's final uncertainty). log g 2.15 from the mass and radius.

**Color.** A Planck spectrum at 4,599 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,599 K and log g 2.15 (u1 0.742, u2 0.063): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
