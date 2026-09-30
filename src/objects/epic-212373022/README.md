# EPIC 212373022

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.94 solar masses and 11.9 solar radii; APOGEE spectra give 5,018 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6295678240615807488, distance 3,779 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212373022 (K2 campaign 6): PARAM asteroseismic distance (pc) 3779.0625 (16th-84th percentiles 3618.164062-3948.125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.245 ± 0.019 mas (12.9 standard errors), is not used. Radius 11.9293 +/- 0.7162 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212373022 (K2 campaign 6): PARAM radius (solar radii) 11.929274 (16th-84th percentiles 11.241809-12.674279), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9358 +/- 0.1293 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212373022 (K2 campaign 6): PARAM mass (solar masses) 0.935827 (16th-84th percentiles 0.816195-1.074768), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,018 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212373022: APOGEE DR17 effective temperature 5017.8535 +/- 50 K (the catalogue's final uncertainty). log g 2.26 from the mass and radius.

**Colour.** A Planck spectrum at 5,018 K, because pARAM fits an extinction A_V = 0.27 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,018 K and log g 2.26 (u1 0.617, u2 0.155): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
