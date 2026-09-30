# EPIC 248689761

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.88 solar masses and 7.2 solar radii; APOGEE spectra give 4,682 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3875475984774278784, distance 1,937 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248689761 (K2 campaign 14): PARAM asteroseismic distance (pc) 1937.441406 (16th-84th percentiles 1896.640625-1987.050781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.543 ± 0.023 mas (23.6 standard errors), is not used. Radius 7.2401 +/- 0.2 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248689761 (K2 campaign 14): PARAM radius (solar radii) 7.240109 (16th-84th percentiles 7.071593-7.471684), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8765 +/- 0.059 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248689761 (K2 campaign 14): PARAM mass (solar masses) 0.876519 (16th-84th percentiles 0.828571-0.946648), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,682 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248689761: APOGEE DR17 effective temperature 4681.5786 +/- 50 K (the catalogue's final uncertainty). log g 2.66 from the mass and radius.

**Colour.** A Planck spectrum at 4,682 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,682 K and log g 2.66 (u1 0.723, u2 0.077): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
