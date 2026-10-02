# EPIC 210733683

## Sources

Its oscillations, recorded in K2 campaign 4, give 2.78 solar masses and 18.6 solar radii; APOGEE spectra give 5,087 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 57479792138338048, distance 4,060 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210733683 (K2 campaign 4): PARAM asteroseismic distance (pc) 4059.960938 (16th-84th percentiles 3980.78125-4126.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.476 ± 0.014 mas (33.7 standard errors), is not used. Radius 18.5659 +/- 0.4867 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210733683 (K2 campaign 4): PARAM radius (solar radii) 18.565878 (16th-84th percentiles 17.989583-18.962905), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.782 +/- 0.1494 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210733683 (K2 campaign 4): PARAM mass (solar masses) 2.782041 (16th-84th percentiles 2.606009-2.904853), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,087 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210733683: APOGEE DR17 effective temperature 5086.7812 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Color.** A Planck spectrum at 5,087 K, because pARAM fits an extinction A_V = 0.42 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,087 K and log g 2.34 (u1 0.600, u2 0.167): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
