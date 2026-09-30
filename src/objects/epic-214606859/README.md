# EPIC 214606859

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.82 solar masses and 21.1 solar radii; GALAH spectra give 4,676 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4073160723712860928, distance 8,673 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214606859 (K2 campaign 7): PARAM asteroseismic distance (pc) 8672.578125 (16th-84th percentiles 8253.828125-9117.890625), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.277 ± 0.022 mas (12.7 standard errors), is not used. Radius 21.0908 +/- 1.5772 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214606859 (K2 campaign 7): PARAM radius (solar radii) 21.090779 (16th-84th percentiles 19.724242-22.878583), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.8176 +/- 0.2996 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214606859 (K2 campaign 7): PARAM mass (solar masses) 1.81756 (16th-84th percentiles 1.565974-2.165184), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,676 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214606859: GALAH DR3 effective temperature 4676.4 +/- 162 K (the catalogue's final uncertainty). log g 2.05 from the mass and radius.

**Colour.** A Planck spectrum at 4,676 K, because pARAM fits an extinction A_V = 0.72 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,676 K and log g 2.05 (u1 0.716, u2 0.083): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
