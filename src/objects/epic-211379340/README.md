# EPIC 211379340

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 10.5 solar radii; GALAH spectra give 4,601 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604638903156749312, distance 1,046 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211379340 (K2 campaign 5): PARAM asteroseismic distance (pc) 1045.927734 (16th-84th percentiles 1028.955078-1059.785156), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.976 ± 0.017 mas (56.0 standard errors), is not used. Radius 10.4826 +/- 0.583 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211379340 (K2 campaign 5): PARAM radius (solar radii) 10.482564 (16th-84th percentiles 9.682713-10.848686), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.134 +/- 0.1395 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211379340 (K2 campaign 5): PARAM mass (solar masses) 1.133953 (16th-84th percentiles 0.958217-1.237192), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,601 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211379340: GALAH DR3 effective temperature 4601.4277 +/- 78 K (the catalogue's final uncertainty). log g 2.45 from the mass and radius.

**Colour.** A Planck spectrum at 4,601 K, because pARAM fits an extinction A_V = 0.27 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,601 K and log g 2.45 (u1 0.746, u2 0.059): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
