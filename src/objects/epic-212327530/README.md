# EPIC 212327530

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.98 solar masses and 9.9 solar radii; APOGEE spectra give 4,679 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6295256474827230592, distance 3,365 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212327530 (K2 campaign 6): PARAM asteroseismic distance (pc) 3364.765625 (16th-84th percentiles 3269.921875-3456.992188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.297 ± 0.018 mas (16.7 standard errors), is not used. Radius 9.8736 +/- 0.3971 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212327530 (K2 campaign 6): PARAM radius (solar radii) 9.873629 (16th-84th percentiles 9.463387-10.257584), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9755 +/- 0.0914 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212327530 (K2 campaign 6): PARAM mass (solar masses) 0.97551 (16th-84th percentiles 0.880202-1.063055), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,679 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212327530: APOGEE DR17 effective temperature 4678.6590000000015 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 4,679 K, because pARAM fits an extinction A_V = 0.31 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,679 K and log g 2.44 (u1 0.721, u2 0.079): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
