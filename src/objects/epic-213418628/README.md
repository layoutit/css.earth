# EPIC 213418628

## Sources

Its oscillations, recorded in K2 campaign 7, give 2.69 solar masses and 17.8 solar radii; APOGEE spectra give 5,147 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6759378749737966464, distance 8,087 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213418628 (K2 campaign 7): PARAM asteroseismic distance (pc) 8087.109375 (16th-84th percentiles 7938.984375-8232.109375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.253 ± 0.019 mas (13.3 standard errors), is not used. Radius 17.8416 +/- 0.624 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213418628 (K2 campaign 7): PARAM radius (solar radii) 17.841636 (16th-84th percentiles 17.01211-18.260143), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.6851 +/- 0.1926 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213418628 (K2 campaign 7): PARAM mass (solar masses) 2.685063 (16th-84th percentiles 2.401897-2.787091), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,147 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213418628: APOGEE DR17 effective temperature 5146.545 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Color.** A Planck spectrum at 5,147 K, because pARAM fits an extinction A_V = 0.45 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,147 K and log g 2.36 (u1 0.584, u2 0.178): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
