# EPIC 206028487

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.42 solar masses and 16.7 solar radii; APOGEE spectra give 4,567 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2600201513423044864, distance 2,102 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206028487 (K2 campaign 3): PARAM asteroseismic distance (pc) 2102.304688 (16th-84th percentiles 2007.714844-2200.175781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.444 ± 0.025 mas (17.5 standard errors), is not used. Radius 16.7191 +/- 1.0647 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206028487 (K2 campaign 3): PARAM radius (solar radii) 16.719079 (16th-84th percentiles 15.698762-17.828066), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4179 +/- 0.1999 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206028487 (K2 campaign 3): PARAM mass (solar masses) 1.417878 (16th-84th percentiles 1.232782-1.632575), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,567 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206028487: APOGEE DR17 effective temperature 4566.788 +/- 50 K (the catalogue's final uncertainty). log g 2.14 from the mass and radius.

**Colour.** A Planck spectrum at 4,567 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,567 K and log g 2.14 (u1 0.752, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
