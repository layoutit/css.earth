# EPIC 201509931

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.90 solar masses and 6.4 solar radii; APOGEE spectra give 4,751 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3699101061115856512, distance 3,696 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201509931 (K2 campaign 10): PARAM asteroseismic distance (pc) 3695.898438 (16th-84th percentiles 3602.734375-3799.414062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.217 ± 0.030 mas (7.3 standard errors), is not used. Radius 6.414 +/- 0.2027 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201509931 (K2 campaign 10): PARAM radius (solar radii) 6.41397 (16th-84th percentiles 6.228653-6.634108), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9006 +/- 0.0695 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201509931 (K2 campaign 10): PARAM mass (solar masses) 0.900596 (16th-84th percentiles 0.839001-0.977951), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,751 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201509931: APOGEE DR17 effective temperature 4751.214 +/- 50 K (the catalogue's final uncertainty). log g 2.78 from the mass and radius.

**Colour.** A Planck spectrum at 4,751 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,751 K and log g 2.78 (u1 0.703, u2 0.092): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
