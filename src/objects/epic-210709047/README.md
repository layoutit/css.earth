# EPIC 210709047

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.96 solar masses and 13.1 solar radii; APOGEE spectra give 4,863 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 49796748480208768, distance 2,794 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210709047 (K2 campaign 4): PARAM asteroseismic distance (pc) 2793.789062 (16th-84th percentiles 2671.601562-2939.023438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.064 ± 0.050 mas (1.3 standard errors), is not used. Radius 13.1082 +/- 0.6955 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210709047 (K2 campaign 4): PARAM radius (solar radii) 13.108183 (16th-84th percentiles 12.472012-13.862975), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9646 +/- 0.2344 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210709047 (K2 campaign 4): PARAM mass (solar masses) 1.964585 (16th-84th percentiles 1.758386-2.227276), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,863 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210709047: APOGEE DR17 effective temperature 4863.107 +/- 50 K (the catalogue's final uncertainty). log g 2.5 from the mass and radius.

**Colour.** A Planck spectrum at 4,863 K, because pARAM fits an extinction A_V = 0.93 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,863 K and log g 2.5 (u1 0.665, u2 0.121): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
