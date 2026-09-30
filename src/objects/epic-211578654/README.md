# EPIC 211578654

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.22 solar masses and 5.9 solar radii; GALAH spectra give 4,897 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 652194185511725696, distance 2,956 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211578654 (K2 campaign 5): PARAM asteroseismic distance (pc) 2955.78125 (16th-84th percentiles 2861.640625-3052.03125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.335 ± 0.021 mas (16.3 standard errors), is not used. Radius 5.884 +/- 0.2201 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211578654 (K2 campaign 5): PARAM radius (solar radii) 5.883985 (16th-84th percentiles 5.668103-6.108295), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2174 +/- 0.1093 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211578654 (K2 campaign 5): PARAM mass (solar masses) 1.217433 (16th-84th percentiles 1.112786-1.331442), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,897 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211578654: GALAH DR3 effective temperature 4897.2944 +/- 136 K (the catalogue's final uncertainty). log g 2.98 from the mass and radius.

**Colour.** A Planck spectrum at 4,897 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe4cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,897 K and log g 2.98 (u1 0.662, u2 0.122): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
