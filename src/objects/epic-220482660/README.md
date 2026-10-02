# EPIC 220482660

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.86 solar masses and 8.3 solar radii; APOGEE spectra give 4,675 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2553241341736596224, distance 3,774 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220482660 (K2 campaign 8): PARAM asteroseismic distance (pc) 3774.335938 (16th-84th percentiles 3692.539062-3879.101562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.207 ± 0.025 mas (8.2 standard errors), is not used. Radius 8.2839 +/- 0.2618 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220482660 (K2 campaign 8): PARAM radius (solar radii) 8.283912 (16th-84th percentiles 8.067196-8.590789), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8595 +/- 0.0671 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220482660 (K2 campaign 8): PARAM mass (solar masses) 0.859459 (16th-84th percentiles 0.806328-0.94055), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,675 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220482660: APOGEE DR17 effective temperature 4674.5576 +/- 50 K (the catalogue's final uncertainty). log g 2.54 from the mass and radius.

**Color.** A Planck spectrum at 4,675 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,675 K and log g 2.54 (u1 0.724, u2 0.077): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
