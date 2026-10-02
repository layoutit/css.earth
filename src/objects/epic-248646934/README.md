# EPIC 248646934

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.88 solar masses and 10.5 solar radii; APOGEE spectra give 4,795 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3865526366615178496, distance 3,971 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248646934 (K2 campaign 14): PARAM asteroseismic distance (pc) 3970.78125 (16th-84th percentiles 3902.617188-4049.648438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.176 ± 0.019 mas (9.2 standard errors), is not used. Radius 10.5257 +/- 0.2708 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248646934 (K2 campaign 14): PARAM radius (solar radii) 10.525683 (16th-84th percentiles 10.29384-10.835425), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8766 +/- 0.0537 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248646934 (K2 campaign 14): PARAM mass (solar masses) 0.876608 (16th-84th percentiles 0.833373-0.940693), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,795 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248646934: APOGEE DR17 effective temperature 4794.996 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Color.** A Planck spectrum at 4,795 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,795 K and log g 2.34 (u1 0.683, u2 0.108): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
