# EPIC 212411479

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.95 solar masses and 11.7 solar radii; APOGEE spectra give 4,752 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3606438894050844288, distance 3,839 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212411479 (K2 campaign 6): PARAM asteroseismic distance (pc) 3839.257812 (16th-84th percentiles 3743.398438-3956.328125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.283 ± 0.016 mas (17.8 standard errors), is not used. Radius 11.7488 +/- 0.5327 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212411479 (K2 campaign 6): PARAM radius (solar radii) 11.748787 (16th-84th percentiles 11.335635-12.401113), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9533 +/- 0.103 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212411479 (K2 campaign 6): PARAM mass (solar masses) 0.953326 (16th-84th percentiles 0.874577-1.080554), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,752 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212411479: APOGEE DR17 effective temperature 4751.6606 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Colour.** A Planck spectrum at 4,752 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,752 K and log g 2.28 (u1 0.695, u2 0.099): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
