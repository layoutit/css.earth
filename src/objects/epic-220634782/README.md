# EPIC 220634782

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.85 solar masses and 7.8 solar radii; APOGEE spectra give 4,672 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2579701329577027200, distance 2,183 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634782 (K2 campaign 8): PARAM asteroseismic distance (pc) 2182.734375 (16th-84th percentiles 2147.675781-2226.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.388 ± 0.016 mas (24.8 standard errors), is not used. Radius 7.8336 +/- 0.1979 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634782 (K2 campaign 8): PARAM radius (solar radii) 7.833614 (16th-84th percentiles 7.677412-8.07323), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8536 +/- 0.0521 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634782 (K2 campaign 8): PARAM mass (solar masses) 0.853632 (16th-84th percentiles 0.815605-0.919827), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,672 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634782: APOGEE DR17 effective temperature 4671.75 +/- 50 K (the catalogue's final uncertainty). log g 2.58 from the mass and radius.

**Color.** A Planck spectrum at 4,672 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,672 K and log g 2.58 (u1 0.725, u2 0.075): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
