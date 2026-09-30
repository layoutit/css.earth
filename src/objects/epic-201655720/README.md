# EPIC 201655720

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.89 solar masses and 10.4 solar radii; APOGEE spectra give 5,009 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3892702896736284032, distance 2,891 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201655720 (K2 campaign 1): PARAM asteroseismic distance (pc) 2891.132812 (16th-84th percentiles 2830.664062-2948.867188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.329 ± 0.018 mas (18.3 standard errors), is not used. Radius 10.4026 +/- 0.3269 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201655720 (K2 campaign 1): PARAM radius (solar radii) 10.402618 (16th-84th percentiles 10.089852-10.743577), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8856 +/- 0.0742 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201655720 (K2 campaign 1): PARAM mass (solar masses) 0.885552 (16th-84th percentiles 0.804316-0.952767), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,009 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201655720: APOGEE DR17 effective temperature 5009.328 +/- 50 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Colour.** A Planck spectrum at 5,009 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,009 K and log g 2.35 (u1 0.620, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
