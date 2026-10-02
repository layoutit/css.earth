# EPIC 211428126

## Sources

Its oscillations, recorded in K2 campaign 18, give 1.05 solar masses and 5.0 solar radii; APOGEE spectra give 4,998 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604985386758978048, distance 2,621 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211428126 (K2 campaign 18): PARAM asteroseismic distance (pc) 2620.46875 (16th-84th percentiles 2545.175781-2697.695312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.363 ± 0.018 mas (19.8 standard errors), is not used. Radius 5.0317 +/- 0.181 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211428126 (K2 campaign 18): PARAM radius (solar radii) 5.031668 (16th-84th percentiles 4.853945-5.215979), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0467 +/- 0.0876 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211428126 (K2 campaign 18): PARAM mass (solar masses) 1.046673 (16th-84th percentiles 0.962445-1.137548), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,998 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211428126: APOGEE DR17 effective temperature 4997.9185 +/- 50 K (the catalogue's final uncertainty). log g 3.05 from the mass and radius.

**Color.** A Planck spectrum at 4,998 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,998 K and log g 3.05 (u1 0.632, u2 0.144): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
