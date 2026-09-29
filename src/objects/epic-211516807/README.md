# EPIC 211516807

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.67 solar masses and 14.9 solar radii; APOGEE spectra give 4,902 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 650552275351963776, distance 8,925 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211516807 (K2 campaign 5): PARAM asteroseismic distance (pc) 8924.84375 (16th-84th percentiles 8642.65625-9237.8125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.141 ± 0.025 mas (5.7 standard errors), is not used. Radius 14.8941 +/- 1.0546 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211516807 (K2 campaign 5): PARAM radius (solar radii) 14.894129 (16th-84th percentiles 14.115042-16.224189), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.6741 +/- 0.2727 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211516807 (K2 campaign 5): PARAM mass (solar masses) 1.674072 (16th-84th percentiles 1.482323-2.027679), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,902 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211516807: APOGEE DR17 effective temperature 4902.1123 +/- 142 K (the catalogue's final uncertainty). log g 2.32 from the mass and radius.

**Colour.** A Planck spectrum at 4,902 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,902 K and log g 2.32 (u1 0.651, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
