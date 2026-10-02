# EPIC 211344234

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.91 solar masses and 10.0 solar radii; APOGEE spectra give 4,919 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 603841374974458624, distance 3,774 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211344234 (K2 campaign 5): PARAM asteroseismic distance (pc) 3773.867188 (16th-84th percentiles 3698.398438-3842.421875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.218 ± 0.016 mas (13.2 standard errors), is not used. Radius 10.0332 +/- 0.2974 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211344234 (K2 campaign 5): PARAM radius (solar radii) 10.033249 (16th-84th percentiles 9.699738-10.29449), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9138 +/- 0.0687 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211344234 (K2 campaign 5): PARAM mass (solar masses) 0.913827 (16th-84th percentiles 0.830339-0.967688), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,919 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211344234: APOGEE DR17 effective temperature 4918.646 +/- 50 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Color.** A Planck spectrum at 4,919 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,919 K and log g 2.4 (u1 0.647, u2 0.134): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
