# EPIC 211308521

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.87 solar masses and 14.2 solar radii; APOGEE spectra give 4,430 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 597752313939908352, distance 2,538 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211308521 (K2 campaign 5): PARAM asteroseismic distance (pc) 2538.066406 (16th-84th percentiles 2485.527344-2607.070312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.393 ± 0.017 mas (23.5 standard errors), is not used. Radius 14.1604 +/- 0.4979 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211308521 (K2 campaign 5): PARAM radius (solar radii) 14.160387 (16th-84th percentiles 13.772728-14.768575), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8667 +/- 0.0684 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211308521 (K2 campaign 5): PARAM mass (solar masses) 0.866716 (16th-84th percentiles 0.816713-0.953511), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,430 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211308521: APOGEE DR17 effective temperature 4429.5664 +/- 50 K (the catalogue's final uncertainty). log g 2.07 from the mass and radius.

**Colour.** A Planck spectrum at 4,430 K, because pARAM fits an extinction A_V = 0.26 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,430 K and log g 2.07 (u1 0.795, u2 0.022): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
