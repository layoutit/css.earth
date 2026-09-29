# EPIC 228736458

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.88 solar masses and 7.1 solar radii; GALAH spectra give 4,532 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3581289317912228352, distance 1,714 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228736458 (K2 campaign 10): PARAM asteroseismic distance (pc) 1713.535156 (16th-84th percentiles 1686.445312-1747.558594), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.510 ± 0.023 mas (22.0 standard errors), is not used. Radius 7.0642 +/- 0.1842 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228736458 (K2 campaign 10): PARAM radius (solar radii) 7.064248 (16th-84th percentiles 6.918333-7.286672), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8791 +/- 0.0544 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228736458 (K2 campaign 10): PARAM mass (solar masses) 0.879115 (16th-84th percentiles 0.838896-0.947598), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,532 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228736458: GALAH DR3 effective temperature 4532.315 +/- 87 K (the catalogue's final uncertainty). log g 2.68 from the mass and radius.

**Colour.** A Planck spectrum at 4,532 K, because pARAM fits an extinction A_V = 0.28 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,532 K and log g 2.68 (u1 0.772, u2 0.038): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
