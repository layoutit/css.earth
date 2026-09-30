# EPIC 248675226

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.82 solar masses and 15.5 solar radii; APOGEE spectra give 5,185 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3863463648441767936, distance 16,316 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248675226 (K2 campaign 14): PARAM asteroseismic distance (pc) 16315.46875 (16th-84th percentiles 15640.78125-17213.90625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, -0.018 ± 0.038 mas (-0.5 standard errors), is not used. Radius 15.4736 +/- 1.0601 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248675226 (K2 campaign 14): PARAM radius (solar radii) 15.47361 (16th-84th percentiles 14.649884-16.770088), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8186 +/- 0.1257 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248675226 (K2 campaign 14): PARAM mass (solar masses) 0.818641 (16th-84th percentiles 0.726615-0.978049), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,185 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248675226: APOGEE DR17 effective temperature 5185.32 +/- 318 K (the catalogue's final uncertainty). log g 1.97 from the mass and radius.

**Colour.** A Planck spectrum at 5,185 K, because pARAM fits an extinction A_V = -0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe9d6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,185 K and log g 1.97 (u1 0.572, u2 0.184): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
