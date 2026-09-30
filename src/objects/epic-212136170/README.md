# EPIC 212136170

## Sources

Its oscillations, recorded in K2 campaign 5, give 2.39 solar masses and 20.8 solar radii; APOGEE spectra give 4,690 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 677933683998930176, distance 5,704 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212136170 (K2 campaign 5): PARAM asteroseismic distance (pc) 5703.671875 (16th-84th percentiles 5267.109375-5927.34375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.166 ± 0.019 mas (8.9 standard errors), is not used. Radius 20.833 +/- 1.2273 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212136170 (K2 campaign 5): PARAM radius (solar radii) 20.832983 (16th-84th percentiles 19.497406-21.952052), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.3929 +/- 0.3062 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212136170 (K2 campaign 5): PARAM mass (solar masses) 2.392942 (16th-84th percentiles 2.060922-2.673348), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,690 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212136170: APOGEE DR17 effective temperature 4690.173 +/- 50 K (the catalogue's final uncertainty). log g 2.18 from the mass and radius.

**Colour.** A Planck spectrum at 4,690 K, because pARAM fits an extinction A_V = 0.22 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,690 K and log g 2.18 (u1 0.714, u2 0.085): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
