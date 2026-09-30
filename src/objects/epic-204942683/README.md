# EPIC 204942683

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.90 solar masses and 10.2 solar radii; GALAH spectra give 4,821 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6247653496865084544, distance 5,037 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 204942683 (K2 campaign 15): PARAM asteroseismic distance (pc) 5036.484375 (16th-84th percentiles 4797.851562-5239.453125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.236 ± 0.022 mas (10.6 standard errors), is not used. Radius 10.2307 +/- 0.569 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 204942683 (K2 campaign 15): PARAM radius (solar radii) 10.23066 (16th-84th percentiles 9.694453-10.832448), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9041 +/- 0.107 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 204942683 (K2 campaign 15): PARAM mass (solar masses) 0.904105 (16th-84th percentiles 0.810138-1.024181), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,821 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 204942683: GALAH DR3 effective temperature 4820.767 +/- 166 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,821 K, because pARAM fits an extinction A_V = 0.44 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,821 K and log g 2.37 (u1 0.676, u2 0.113): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
