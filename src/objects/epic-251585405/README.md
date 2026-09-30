# EPIC 251585405

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.03 solar masses and 12.3 solar radii; APOGEE spectra give 4,657 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3638271508021533056, distance 1,639 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251585405 (K2 campaign 17): PARAM asteroseismic distance (pc) 1638.671875 (16th-84th percentiles 1572.753906-1706.191406), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.598 ± 0.021 mas (28.1 standard errors), is not used. Radius 12.2621 +/- 0.6543 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251585405 (K2 campaign 17): PARAM radius (solar radii) 12.262074 (16th-84th percentiles 11.633095-12.941613), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0308 +/- 0.1268 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251585405 (K2 campaign 17): PARAM mass (solar masses) 1.030791 (16th-84th percentiles 0.912882-1.166472), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,657 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251585405: APOGEE DR17 effective temperature 4657.1514 +/- 50 K (the catalogue's final uncertainty). log g 2.27 from the mass and radius.

**Colour.** A Planck spectrum at 4,657 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,657 K and log g 2.27 (u1 0.726, u2 0.076): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
