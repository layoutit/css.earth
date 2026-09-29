# EPIC 211473178

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.06 solar masses and 11.1 solar radii; APOGEE spectra give 4,881 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 605281327184921088, distance 4,374 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211473178 (K2 campaign 5): PARAM asteroseismic distance (pc) 4373.710938 (16th-84th percentiles 4287.070312-4514.492188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.240 ± 0.018 mas (13.2 standard errors), is not used. Radius 11.0938 +/- 0.4214 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211473178 (K2 campaign 5): PARAM radius (solar radii) 11.093839 (16th-84th percentiles 10.743424-11.586308), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.058 +/- 0.0945 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211473178 (K2 campaign 5): PARAM mass (solar masses) 1.057999 (16th-84th percentiles 0.973462-1.162527), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,881 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211473178: APOGEE DR17 effective temperature 4880.5166 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,881 K, because pARAM fits an extinction A_V = 0.28 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,881 K and log g 2.37 (u1 0.658, u2 0.126): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
