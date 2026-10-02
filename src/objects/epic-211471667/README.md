# EPIC 211471667

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.06 solar masses and 9.6 solar radii; APOGEE spectra give 4,741 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604565270237479424, distance 4,288 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211471667 (K2 campaign 5): PARAM asteroseismic distance (pc) 4288.203125 (16th-84th percentiles 4162.773438-4425.039062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.188 ± 0.018 mas (10.2 standard errors), is not used. Radius 9.6092 +/- 0.6969 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211471667 (K2 campaign 5): PARAM radius (solar radii) 9.609164 (16th-84th percentiles 9.197439-10.591278), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0575 +/- 0.1718 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211471667 (K2 campaign 5): PARAM mass (solar masses) 1.057517 (16th-84th percentiles 0.953128-1.296711), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,741 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211471667: APOGEE DR17 effective temperature 4741.182 +/- 93 K (the catalogue's final uncertainty). log g 2.5 from the mass and radius.

**Color.** A Planck spectrum at 4,741 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,741 K and log g 2.5 (u1 0.702, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
