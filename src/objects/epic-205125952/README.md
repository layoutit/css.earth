# EPIC 205125952

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.89 solar masses and 10.3 solar radii; APOGEE spectra give 4,699 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6245608233435602816, distance 1,953 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205125952 (K2 campaign 2): PARAM asteroseismic distance (pc) 1952.65625 (16th-84th percentiles 1922.832031-1986.875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.449 ± 0.017 mas (26.2 standard errors), is not used. Radius 10.2535 +/- 0.2289 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205125952 (K2 campaign 2): PARAM radius (solar radii) 10.253497 (16th-84th percentiles 10.083213-10.541105), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8911 +/- 0.0475 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205125952 (K2 campaign 2): PARAM mass (solar masses) 0.891122 (16th-84th percentiles 0.852164-0.947119), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,699 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205125952: APOGEE DR17 effective temperature 4698.8354 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,699 K, because pARAM fits an extinction A_V = 1.40 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,699 K and log g 2.37 (u1 0.713, u2 0.085): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
