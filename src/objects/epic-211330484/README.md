# EPIC 211330484

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 11.3 solar radii; APOGEE spectra give 4,879 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 600960349568324480, distance 3,488 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330484 (K2 campaign 5): PARAM asteroseismic distance (pc) 3488.007812 (16th-84th percentiles 3411.328125-3553.28125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.268 ± 0.013 mas (20.3 standard errors), is not used. Radius 11.2609 +/- 0.4909 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330484 (K2 campaign 5): PARAM radius (solar radii) 11.260889 (16th-84th percentiles 10.636864-11.618591), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1335 +/- 0.1215 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330484 (K2 campaign 5): PARAM mass (solar masses) 1.133519 (16th-84th percentiles 0.994739-1.237802), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,879 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330484: APOGEE DR17 effective temperature 4878.826 +/- 50 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Color.** A Planck spectrum at 4,879 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,879 K and log g 2.39 (u1 0.659, u2 0.125): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
