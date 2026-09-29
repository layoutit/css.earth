# EPIC 212726817

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.55 solar masses and 16.5 solar radii; GALAH spectra give 4,592 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3625360698890767616, distance 1,823 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212726817 (K2 campaign 17): PARAM asteroseismic distance (pc) 1823.261719 (16th-84th percentiles 1733.964844-1921.367188), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.687 ± 0.024 mas (28.6 standard errors), is not used. Radius 16.4641 +/- 1.4016 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212726817 (K2 campaign 17): PARAM radius (solar radii) 16.464094 (16th-84th percentiles 15.324887-18.128134), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5547 +/- 0.3072 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212726817 (K2 campaign 17): PARAM mass (solar masses) 1.554731 (16th-84th percentiles 1.324718-1.939038), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,592 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 212726817: GALAH DR3 effective temperature 4591.712 +/- 89 K (the catalogue's final uncertainty). log g 2.2 from the mass and radius.

**Colour.** A Planck spectrum at 4,592 K, because pARAM fits an extinction A_V = 0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,592 K and log g 2.2 (u1 0.745, u2 0.061): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
