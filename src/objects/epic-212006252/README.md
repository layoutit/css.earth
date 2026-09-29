# EPIC 212006252

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.08 solar masses and 11.4 solar radii; APOGEE spectra give 4,736 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 675829532277211392, distance 5,184 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212006252 (K2 campaign 5): PARAM asteroseismic distance (pc) 5184.0625 (16th-84th percentiles 4990-5365.234375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.146 ± 0.026 mas (5.7 standard errors), is not used. Radius 11.3987 +/- 0.5604 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212006252 (K2 campaign 5): PARAM radius (solar radii) 11.398694 (16th-84th percentiles 10.807705-11.928475), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0773 +/- 0.121 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212006252 (K2 campaign 5): PARAM mass (solar masses) 1.077296 (16th-84th percentiles 0.948788-1.190779), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,736 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212006252: APOGEE DR17 effective temperature 4736.102 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,736 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,736 K and log g 2.36 (u1 0.701, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
