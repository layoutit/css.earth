# EPIC 212302713

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.96 solar masses and 10.1 solar radii; APOGEE spectra give 4,860 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6293738599025080448, distance 3,051 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212302713 (K2 campaign 6): PARAM asteroseismic distance (pc) 3050.546875 (16th-84th percentiles 2987.929688-3111.679688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.291 ± 0.017 mas (17.2 standard errors), is not used. Radius 10.083 +/- 0.2962 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212302713 (K2 campaign 6): PARAM radius (solar radii) 10.083002 (16th-84th percentiles 9.776028-10.368495), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9634 +/- 0.0724 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212302713 (K2 campaign 6): PARAM mass (solar masses) 0.963378 (16th-84th percentiles 0.892697-1.037532), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,860 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212302713: APOGEE DR17 effective temperature 4860.053 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 4,860 K, because pARAM fits an extinction A_V = 0.30 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,860 K and log g 2.41 (u1 0.665, u2 0.121): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
