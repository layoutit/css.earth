# EPIC 250019361

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.93 solar masses and 10.5 solar radii; GALAH spectra give 4,578 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6262155608558635904, distance 1,678 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250019361 (K2 campaign 15): PARAM asteroseismic distance (pc) 1677.636719 (16th-84th percentiles 1617.851562-1747.050781), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.624 ± 0.015 mas (42.6 standard errors), is not used. Radius 10.4852 +/- 0.4941 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250019361 (K2 campaign 15): PARAM radius (solar radii) 10.485177 (16th-84th percentiles 10.058864-11.04707), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9258 +/- 0.1061 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250019361 (K2 campaign 15): PARAM mass (solar masses) 0.925848 (16th-84th percentiles 0.838323-1.050548), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,578 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250019361: GALAH DR3 effective temperature 4578.3286 +/- 92 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,578 K, because pARAM fits an extinction A_V = 0.40 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,578 K and log g 2.36 (u1 0.752, u2 0.055): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
