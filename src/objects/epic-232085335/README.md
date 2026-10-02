# EPIC 232085335

## Sources

Its oscillations, recorded in K2 campaign 11, give 1.82 solar masses and 20.6 solar radii; APOGEE spectra give 4,604 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6033364139518359168, distance 3,188 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 232085335 (K2 campaign 11): PARAM asteroseismic distance (pc) 3188.28125 (16th-84th percentiles 2941.679688-3819.296875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.820 ± 0.017 mas (47.3 standard errors), is not used. Radius 20.5732 +/- 1.4825 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 232085335 (K2 campaign 11): PARAM radius (solar radii) 20.573232 (16th-84th percentiles 18.313536-21.278573), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.8229 +/- 0.2685 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 232085335 (K2 campaign 11): PARAM mass (solar masses) 1.822899 (16th-84th percentiles 1.424507-1.961478), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,604 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 232085335: APOGEE DR17 effective temperature 4603.544 +/- 50 K (the catalogue's final uncertainty). log g 2.07 from the mass and radius.

**Color.** A Planck spectrum at 4,604 K, because pARAM fits an extinction A_V = 0.34 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,604 K and log g 2.07 (u1 0.739, u2 0.066): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
