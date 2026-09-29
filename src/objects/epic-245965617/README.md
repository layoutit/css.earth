# EPIC 245965617

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.78 solar masses and 18.4 solar radii; APOGEE spectra give 4,779 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2437027532525695616, distance 4,033 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245965617 (K2 campaign 12): PARAM asteroseismic distance (pc) 4032.578125 (16th-84th percentiles 3919.0625-4193.671875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.286 ± 0.018 mas (16.3 standard errors), is not used. Radius 18.3907 +/- 0.9918 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245965617 (K2 campaign 12): PARAM radius (solar radii) 18.390654 (16th-84th percentiles 17.631577-19.615185), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.781 +/- 0.0935 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245965617 (K2 campaign 12): PARAM mass (solar masses) 0.781034 (16th-84th percentiles 0.713359-0.900283), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,779 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245965617: APOGEE DR17 effective temperature 4779.145 +/- 50 K (the catalogue's final uncertainty). log g 1.8 from the mass and radius.

**Colour.** A Planck spectrum at 4,779 K, because pARAM fits an extinction A_V = -0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,779 K and log g 1.8 (u1 0.683, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
