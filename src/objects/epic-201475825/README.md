# EPIC 201475825

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.83 solar masses and 10.0 solar radii; APOGEE spectra give 4,992 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3807797165729685504, distance 3,408 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201475825 (K2 campaign 14): PARAM asteroseismic distance (pc) 3408.4375 (16th-84th percentiles 3352.109375-3471.523438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.300 ± 0.016 mas (18.9 standard errors), is not used. Radius 10.0322 +/- 0.2748 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201475825 (K2 campaign 14): PARAM radius (solar radii) 10.032178 (16th-84th percentiles 9.791425-10.34105), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8347 +/- 0.0588 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201475825 (K2 campaign 14): PARAM mass (solar masses) 0.83471 (16th-84th percentiles 0.78301-0.900576), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,992 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201475825: APOGEE DR17 effective temperature 4992.2036 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,992 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,992 K and log g 2.36 (u1 0.625, u2 0.150): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
