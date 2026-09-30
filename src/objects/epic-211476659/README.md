# EPIC 211476659

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 10.6 solar radii; APOGEE spectra give 4,707 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 602324431180927232, distance 3,539 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211476659 (K2 campaign 5): PARAM asteroseismic distance (pc) 3538.945312 (16th-84th percentiles 3473.476562-3597.851562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.257 ± 0.015 mas (16.7 standard errors), is not used. Radius 10.6059 +/- 0.265 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211476659 (K2 campaign 5): PARAM radius (solar radii) 10.605917 (16th-84th percentiles 10.335346-10.865357), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1332 +/- 0.0778 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211476659 (K2 campaign 5): PARAM mass (solar masses) 1.133226 (16th-84th percentiles 1.051159-1.206745), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,707 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211476659: APOGEE DR17 effective temperature 4706.9272 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 4,707 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,707 K and log g 2.44 (u1 0.712, u2 0.086): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
