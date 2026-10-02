# EPIC 231357535

## Sources

Its oscillations, recorded in K2 campaign 11, give 1.10 solar masses and 13.3 solar radii; APOGEE spectra give 4,477 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4113924430108975872, distance 2,392 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231357535 (K2 campaign 11): PARAM asteroseismic distance (pc) 2391.757812 (16th-84th percentiles 2295.9375-2491.523438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.376 ± 0.020 mas (18.4 standard errors), is not used. Radius 13.3202 +/- 0.7195 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231357535 (K2 campaign 11): PARAM radius (solar radii) 13.320215 (16th-84th percentiles 12.630486-14.069563), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0957 +/- 0.1359 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231357535 (K2 campaign 11): PARAM mass (solar masses) 1.095727 (16th-84th percentiles 0.96988-1.241588), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,477 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231357535: APOGEE DR17 effective temperature 4477.4243 +/- 50 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Color.** A Planck spectrum at 4,477 K, because pARAM fits an extinction A_V = 1.54 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,477 K and log g 2.23 (u1 0.782, u2 0.032): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
