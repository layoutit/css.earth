# EPIC 249223691

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.79 solar masses and 19.9 solar radii; GALAH spectra give 4,724 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6234951384484242688, distance 5,444 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249223691 (K2 campaign 15): PARAM asteroseismic distance (pc) 5444.0625 (16th-84th percentiles 5223.75-5662.109375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.259 ± 0.015 mas (16.8 standard errors), is not used. Radius 19.855 +/- 1.4232 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249223691 (K2 campaign 15): PARAM radius (solar radii) 19.855023 (16th-84th percentiles 18.363112-21.209431), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.7854 +/- 0.2759 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249223691 (K2 campaign 15): PARAM mass (solar masses) 1.78539 (16th-84th percentiles 1.505638-2.057464), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,724 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249223691: GALAH DR3 effective temperature 4724.496 +/- 123 K (the catalogue's final uncertainty). log g 2.09 from the mass and radius.

**Colour.** A Planck spectrum at 4,724 K, because pARAM fits an extinction A_V = 0.56 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,724 K and log g 2.09 (u1 0.702, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
