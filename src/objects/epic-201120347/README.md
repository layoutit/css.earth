# EPIC 201120347

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.84 solar masses and 14.6 solar radii; GALAH spectra give 4,329 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3595792529118689920, distance 2,017 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 201120347 (K2 campaign 10): PARAM asteroseismic distance (pc) 2017.441406 (16th-84th percentiles 1982.148438-2060.019531), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.469 ± 0.031 mas (14.9 standard errors), is not used. Radius 14.5578 +/- 0.424 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 201120347 (K2 campaign 10): PARAM radius (solar radii) 14.557815 (16th-84th percentiles 14.223065-15.071058), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8393 +/- 0.0499 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 201120347 (K2 campaign 10): PARAM mass (solar masses) 0.839254 (16th-84th percentiles 0.805854-0.905686), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,329 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 201120347: GALAH DR3 effective temperature 4328.874 +/- 80 K (the catalogue's final uncertainty). log g 2.04 from the mass and radius.

**Colour.** A Planck spectrum at 4,329 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,329 K and log g 2.04 (u1 0.828, u2 -0.006): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
