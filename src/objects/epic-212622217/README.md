# EPIC 212622217

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.89 solar masses and 11.3 solar radii; GALAH spectra give 4,765 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3624380102022356096, distance 2,756 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212622217 (K2 campaign 6): PARAM asteroseismic distance (pc) 2755.546875 (16th-84th percentiles 2681.171875-2837.617188), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.366 ± 0.016 mas (23.5 standard errors), is not used. Radius 11.3091 +/- 0.4376 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212622217 (K2 campaign 6): PARAM radius (solar radii) 11.309116 (16th-84th percentiles 10.912696-11.787821), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8863 +/- 0.0759 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212622217 (K2 campaign 6): PARAM mass (solar masses) 0.886295 (16th-84th percentiles 0.823325-0.975154), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,765 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212622217: GALAH DR3 effective temperature 4764.9736 +/- 187 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Colour.** A Planck spectrum at 4,765 K, because pARAM fits an extinction A_V = -0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,765 K and log g 2.28 (u1 0.692, u2 0.102): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
