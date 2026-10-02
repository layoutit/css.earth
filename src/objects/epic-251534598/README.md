# EPIC 251534598

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.92 solar masses and 9.9 solar radii; APOGEE spectra give 4,561 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3637905886045440512, distance 4,303 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251534598 (K2 campaign 17): PARAM asteroseismic distance (pc) 4302.929688 (16th-84th percentiles 4189.140625-4440.976562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.214 ± 0.022 mas (9.9 standard errors), is not used. Radius 9.9335 +/- 0.3654 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251534598 (K2 campaign 17): PARAM radius (solar radii) 9.933511 (16th-84th percentiles 9.620117-10.350876), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9184 +/- 0.0812 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251534598 (K2 campaign 17): PARAM mass (solar masses) 0.918423 (16th-84th percentiles 0.851237-1.013603), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,561 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251534598: APOGEE DR17 effective temperature 4560.657 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Color.** A Planck spectrum at 4,561 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,561 K and log g 2.41 (u1 0.759, u2 0.050): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
