# EPIC 246314082

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.72 solar masses and 11.5 solar radii; APOGEE spectra give 5,003 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2637580033979851264, distance 2,936 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246314082 (K2 campaign 12): PARAM asteroseismic distance (pc) 2936.25 (16th-84th percentiles 2880.15625-3004.101562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.367 ± 0.015 mas (23.9 standard errors), is not used. Radius 11.5274 +/- 0.3203 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246314082 (K2 campaign 12): PARAM radius (solar radii) 11.527358 (16th-84th percentiles 11.281036-11.92168), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7153 +/- 0.046 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246314082 (K2 campaign 12): PARAM mass (solar masses) 0.715272 (16th-84th percentiles 0.684128-0.776082), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,003 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246314082: APOGEE DR17 effective temperature 5003.435 +/- 50 K (the catalogue's final uncertainty). log g 2.17 from the mass and radius.

**Colour.** A Planck spectrum at 5,003 K, because pARAM fits an extinction A_V = -0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,003 K and log g 2.17 (u1 0.620, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
