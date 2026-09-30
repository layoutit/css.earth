# EPIC 206172067

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.88 solar masses and 10.5 solar radii; APOGEE spectra give 4,668 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2603018019832091648, distance 3,201 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206172067 (K2 campaign 3): PARAM asteroseismic distance (pc) 3201.40625 (16th-84th percentiles 3103.203125-3326.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.256 ± 0.017 mas (14.9 standard errors), is not used. Radius 10.4945 +/- 0.476 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206172067 (K2 campaign 3): PARAM radius (solar radii) 10.494541 (16th-84th percentiles 10.099337-11.051386), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8831 +/- 0.0986 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206172067 (K2 campaign 3): PARAM mass (solar masses) 0.883105 (16th-84th percentiles 0.805966-1.003181), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,668 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206172067: APOGEE DR17 effective temperature 4667.641 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,668 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,668 K and log g 2.34 (u1 0.723, u2 0.078): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
