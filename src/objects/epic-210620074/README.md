# EPIC 210620074

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.46 solar masses and 9.9 solar radii; APOGEE spectra give 4,731 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 43746273431126016, distance 2,058 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210620074 (K2 campaign 4): PARAM asteroseismic distance (pc) 2057.8125 (16th-84th percentiles 1995.390625-2123.789062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.494 ± 0.013 mas (38.5 standard errors), is not used. Radius 9.9426 +/- 0.4397 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210620074 (K2 campaign 4): PARAM radius (solar radii) 9.942605 (16th-84th percentiles 9.526567-10.405968), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4623 +/- 0.1521 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210620074 (K2 campaign 4): PARAM mass (solar masses) 1.462341 (16th-84th percentiles 1.320822-1.625047), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,731 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210620074: APOGEE DR17 effective temperature 4730.823 +/- 50 K (the catalogue's final uncertainty). log g 2.61 from the mass and radius.

**Color.** A Planck spectrum at 4,731 K, because pARAM fits an extinction A_V = 0.81 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,731 K and log g 2.61 (u1 0.707, u2 0.090): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
