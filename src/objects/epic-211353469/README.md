# EPIC 211353469

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.01 solar masses and 8.4 solar radii; APOGEE spectra give 4,574 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 601434067280581248, distance 2,665 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211353469 (K2 campaign 5): PARAM asteroseismic distance (pc) 2665.429688 (16th-84th percentiles 2605.703125-2726.054688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.333 ± 0.017 mas (20.1 standard errors), is not used. Radius 8.401 +/- 0.2492 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211353469 (K2 campaign 5): PARAM radius (solar radii) 8.400952 (16th-84th percentiles 8.153055-8.651424), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0072 +/- 0.0673 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211353469 (K2 campaign 5): PARAM mass (solar masses) 1.007245 (16th-84th percentiles 0.940746-1.075332), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,574 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211353469: APOGEE DR17 effective temperature 4573.5522 +/- 50 K (the catalogue's final uncertainty). log g 2.59 from the mass and radius.

**Color.** A Planck spectrum at 4,574 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,574 K and log g 2.59 (u1 0.757, u2 0.050): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
