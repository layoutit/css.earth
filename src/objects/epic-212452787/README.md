# EPIC 212452787

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.36 solar masses and 11.7 solar radii; APOGEE spectra give 4,679 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3609038964172739968, distance 4,956 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212452787 (K2 campaign 17): PARAM asteroseismic distance (pc) 4955.859375 (16th-84th percentiles 4816.640625-5070.820312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.213 ± 0.020 mas (10.8 standard errors), is not used. Radius 11.7272 +/- 0.4621 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212452787 (K2 campaign 17): PARAM radius (solar radii) 11.727232 (16th-84th percentiles 11.218151-12.142348), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3634 +/- 0.1209 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212452787 (K2 campaign 17): PARAM mass (solar masses) 1.363399 (16th-84th percentiles 1.225152-1.466924), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,679 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212452787: APOGEE DR17 effective temperature 4678.789000000002 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,679 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,679 K and log g 2.43 (u1 0.721, u2 0.079): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
