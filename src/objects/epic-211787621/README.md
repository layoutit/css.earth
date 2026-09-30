# EPIC 211787621

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.64 solar masses and 16.2 solar radii; APOGEE spectra give 4,869 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 659783500099477504, distance 7,276 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211787621 (K2 campaign 5): PARAM asteroseismic distance (pc) 7276.328125 (16th-84th percentiles 6938.4375-7606.71875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.160 ± 0.021 mas (7.6 standard errors), is not used. Radius 16.1612 +/- 0.9518 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211787621 (K2 campaign 5): PARAM radius (solar radii) 16.161216 (16th-84th percentiles 15.141166-17.04467), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.636 +/- 0.2241 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211787621 (K2 campaign 5): PARAM mass (solar masses) 1.636007 (16th-84th percentiles 1.411062-1.8593), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,869 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211787621: APOGEE DR17 effective temperature 4869.114000000001 +/- 50 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Colour.** A Planck spectrum at 4,869 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,869 K and log g 2.23 (u1 0.660, u2 0.124): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
