# EPIC 245988600

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.92 solar masses and 10.7 solar radii; APOGEE spectra give 4,569 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2435640223729303552, distance 3,769 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245988600 (K2 campaign 12): PARAM asteroseismic distance (pc) 3769.023438 (16th-84th percentiles 3647.304688-3904.765625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.236 ± 0.023 mas (10.5 standard errors), is not used. Radius 10.6728 +/- 0.4313 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245988600 (K2 campaign 12): PARAM radius (solar radii) 10.672843 (16th-84th percentiles 10.296282-11.158933), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9166 +/- 0.0878 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245988600 (K2 campaign 12): PARAM mass (solar masses) 0.91664 (16th-84th percentiles 0.842908-1.018519), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,569 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245988600: APOGEE DR17 effective temperature 4569.2173 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Color.** A Planck spectrum at 4,569 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,569 K and log g 2.34 (u1 0.755, u2 0.053): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
