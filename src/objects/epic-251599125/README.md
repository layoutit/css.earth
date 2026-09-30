# EPIC 251599125

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.88 solar masses and 10.2 solar radii; APOGEE spectra give 4,702 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3686413109247482496, distance 3,070 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251599125 (K2 campaign 17): PARAM asteroseismic distance (pc) 3069.492188 (16th-84th percentiles 3029.921875-3111.835938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.304 ± 0.015 mas (19.7 standard errors), is not used. Radius 10.1824 +/- 0.2008 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251599125 (K2 campaign 17): PARAM radius (solar radii) 10.182448 (16th-84th percentiles 10.015468-10.417054), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8831 +/- 0.0441 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251599125 (K2 campaign 17): PARAM mass (solar masses) 0.883122 (16th-84th percentiles 0.844893-0.933049), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,702 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251599125: APOGEE DR17 effective temperature 4702.003 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,702 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,702 K and log g 2.37 (u1 0.712, u2 0.086): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
