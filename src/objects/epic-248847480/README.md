# EPIC 248847480

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.86 solar masses and 9.9 solar radii; APOGEE spectra give 4,982 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3871538564915840000, distance 2,830 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248847480 (K2 campaign 14): PARAM asteroseismic distance (pc) 2829.804688 (16th-84th percentiles 2772.382812-2892.617188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.352 ± 0.017 mas (20.6 standard errors), is not used. Radius 9.9169 +/- 0.2968 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248847480 (K2 campaign 14): PARAM radius (solar radii) 9.9169 (16th-84th percentiles 9.664925-10.25848), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8556 +/- 0.0599 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248847480 (K2 campaign 14): PARAM mass (solar masses) 0.85556 (16th-84th percentiles 0.808268-0.927986), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,982 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248847480: APOGEE DR17 effective temperature 4981.545999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Color.** A Planck spectrum at 4,982 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,982 K and log g 2.38 (u1 0.628, u2 0.148): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
