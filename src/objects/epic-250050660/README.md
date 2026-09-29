# EPIC 250050660

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.49 solar masses and 15.1 solar radii; GALAH spectra give 4,707 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6259972665656531968, distance 2,918 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250050660 (K2 campaign 15): PARAM asteroseismic distance (pc) 2917.890625 (16th-84th percentiles 2782.1875-3056.679688), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.372 ± 0.014 mas (26.2 standard errors), is not used. Radius 15.1276 +/- 1.0298 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250050660 (K2 campaign 15): PARAM radius (solar radii) 15.12757 (16th-84th percentiles 14.211463-16.270995), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4898 +/- 0.2309 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250050660 (K2 campaign 15): PARAM mass (solar masses) 1.489836 (16th-84th percentiles 1.29366-1.755532), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,707 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 250050660: GALAH DR3 effective temperature 4706.736 +/- 83 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Colour.** A Planck spectrum at 4,707 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,707 K and log g 2.25 (u1 0.709, u2 0.088): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
