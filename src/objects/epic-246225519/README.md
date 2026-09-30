# EPIC 246225519

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.82 solar masses and 11.9 solar radii; APOGEE spectra give 4,985 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2633175321679632128, distance 2,379 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246225519 (K2 campaign 12): PARAM asteroseismic distance (pc) 2379.042969 (16th-84th percentiles 2289.0625-2484.492188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.402 ± 0.014 mas (29.1 standard errors), is not used. Radius 11.9131 +/- 0.6064 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246225519 (K2 campaign 12): PARAM radius (solar radii) 11.913126 (16th-84th percentiles 11.374877-12.587627), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8189 +/- 0.0995 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246225519 (K2 campaign 12): PARAM mass (solar masses) 0.818902 (16th-84th percentiles 0.732895-0.931972), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,985 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246225519: APOGEE DR17 effective temperature 4984.7104 +/- 50 K (the catalogue's final uncertainty). log g 2.2 from the mass and radius.

**Colour.** A Planck spectrum at 4,985 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,985 K and log g 2.2 (u1 0.626, u2 0.149): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
