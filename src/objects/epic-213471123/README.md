# EPIC 213471123

## Sources

Its oscillations, recorded in K2 campaign 7, give 0.86 solar masses and 22.6 solar radii; GALAH spectra give 4,382 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6758721379221019776, distance 6,321 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213471123 (K2 campaign 7): PARAM asteroseismic distance (pc) 6320.625 (16th-84th percentiles 6168.125-6505.078125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.132 ± 0.023 mas (5.7 standard errors), is not used. Radius 22.6308 +/- 0.9299 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213471123 (K2 campaign 7): PARAM radius (solar radii) 22.630754 (16th-84th percentiles 21.874477-23.734224), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8617 +/- 0.0706 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213471123 (K2 campaign 7): PARAM mass (solar masses) 0.861741 (16th-84th percentiles 0.811949-0.953159), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,382 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213471123: GALAH DR3 effective temperature 4381.988 +/- 127 K (the catalogue's final uncertainty). log g 1.66 from the mass and radius.

**Colour.** A Planck spectrum at 4,382 K, because pARAM fits an extinction A_V = 0.26 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdbb7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,382 K and log g 1.66 (u1 0.808, u2 0.012): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
