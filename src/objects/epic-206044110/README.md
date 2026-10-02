# EPIC 206044110

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.88 solar masses and 7.0 solar radii; APOGEE spectra give 4,692 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2603375876507538688, distance 2,437 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206044110 (K2 campaign 3): PARAM asteroseismic distance (pc) 2436.542969 (16th-84th percentiles 2384.6875-2497.734375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.371 ± 0.016 mas (23.3 standard errors), is not used. Radius 6.9745 +/- 0.1987 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206044110 (K2 campaign 3): PARAM radius (solar radii) 6.974505 (16th-84th percentiles 6.806055-7.203361), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8781 +/- 0.0605 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206044110 (K2 campaign 3): PARAM mass (solar masses) 0.878119 (16th-84th percentiles 0.828295-0.949242), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,692 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206044110: APOGEE DR17 effective temperature 4692.253 +/- 50 K (the catalogue's final uncertainty). log g 2.69 from the mass and radius.

**Color.** A Planck spectrum at 4,692 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,692 K and log g 2.69 (u1 0.720, u2 0.079): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
