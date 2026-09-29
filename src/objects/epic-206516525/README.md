# EPIC 206516525

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.81 solar masses and 15.2 solar radii; APOGEE spectra give 4,451 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2626602990924497920, distance 3,039 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206516525 (K2 campaign 3): PARAM asteroseismic distance (pc) 3039.140625 (16th-84th percentiles 2997.5-3084.921875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.385 ± 0.019 mas (20.6 standard errors), is not used. Radius 15.1663 +/- 0.2733 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206516525 (K2 campaign 3): PARAM radius (solar radii) 15.166344 (16th-84th percentiles 14.922709-15.469253), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8096 +/- 0.0287 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206516525 (K2 campaign 3): PARAM mass (solar masses) 0.809611 (16th-84th percentiles 0.790396-0.847828), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,451 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206516525: APOGEE DR17 effective temperature 4450.5 +/- 50 K (the catalogue's final uncertainty). log g 1.98 from the mass and radius.

**Colour.** A Planck spectrum at 4,451 K, because pARAM fits an extinction A_V = 0.38 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,451 K and log g 1.98 (u1 0.787, u2 0.029): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
