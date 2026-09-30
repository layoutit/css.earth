# EPIC 212412068

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.84 solar masses and 9.9 solar radii; APOGEE spectra give 4,897 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3608265625245454848, distance 1,661 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212412068 (K2 campaign 6): PARAM asteroseismic distance (pc) 1660.566406 (16th-84th percentiles 1629.960938-1695.800781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.576 ± 0.021 mas (27.5 standard errors), is not used. Radius 9.8887 +/- 0.2597 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212412068 (K2 campaign 6): PARAM radius (solar radii) 9.888683 (16th-84th percentiles 9.686526-10.205922), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8397 +/- 0.0497 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212412068 (K2 campaign 6): PARAM mass (solar masses) 0.839651 (16th-84th percentiles 0.803569-0.902976), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,897 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212412068: APOGEE DR17 effective temperature 4896.6646 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,897 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,897 K and log g 2.37 (u1 0.653, u2 0.129): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
