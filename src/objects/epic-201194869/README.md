# EPIC 201194869

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.93 solar masses and 12.1 solar radii; APOGEE spectra give 4,839 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3786872325581933952, distance 1,166 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201194869 (K2 campaign 1): PARAM asteroseismic distance (pc) 1166.269531 (16th-84th percentiles 1140.019531-1192.011719), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.816 ± 0.014 mas (56.5 standard errors), is not used. Radius 12.12 +/- 0.3798 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201194869 (K2 campaign 1): PARAM radius (solar radii) 12.120001 (16th-84th percentiles 11.733614-12.493122), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.926 +/- 0.0822 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201194869 (K2 campaign 1): PARAM mass (solar masses) 0.925996 (16th-84th percentiles 0.849619-1.013983), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,839 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201194869: APOGEE DR17 effective temperature 4839.4043 +/- 50 K (the catalogue's final uncertainty). log g 2.24 from the mass and radius.

**Colour.** A Planck spectrum at 4,839 K, because pARAM fits an extinction A_V = 0.23 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,839 K and log g 2.24 (u1 0.669, u2 0.118): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
