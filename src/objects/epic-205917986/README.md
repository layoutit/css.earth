# EPIC 205917986

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.81 solar masses and 8.1 solar radii; APOGEE spectra give 4,704 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2594742747429020800, distance 3,282 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205917986 (K2 campaign 3): PARAM asteroseismic distance (pc) 3281.757812 (16th-84th percentiles 3235.625-3335.078125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.265 ± 0.019 mas (14.0 standard errors), is not used. Radius 8.1036 +/- 0.1547 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205917986 (K2 campaign 3): PARAM radius (solar radii) 8.103569 (16th-84th percentiles 7.983171-8.292614), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8108 +/- 0.0351 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205917986 (K2 campaign 3): PARAM mass (solar masses) 0.810834 (16th-84th percentiles 0.787192-0.857358), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,704 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205917986: APOGEE DR17 effective temperature 4704.1255 +/- 50 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,704 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,704 K and log g 2.53 (u1 0.714, u2 0.084): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
