# EPIC 248590462

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.04 solar masses and 10.3 solar radii; APOGEE spectra give 4,793 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3861563486190753536, distance 2,353 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248590462 (K2 campaign 14): PARAM asteroseismic distance (pc) 2352.949219 (16th-84th percentiles 2293.203125-2415.800781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.383 ± 0.020 mas (18.8 standard errors), is not used. Radius 10.3198 +/- 0.3721 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248590462 (K2 campaign 14): PARAM radius (solar radii) 10.319837 (16th-84th percentiles 9.965893-10.709994), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0381 +/- 0.0857 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248590462 (K2 campaign 14): PARAM mass (solar masses) 1.038109 (16th-84th percentiles 0.959192-1.130602), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,793 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248590462: APOGEE DR17 effective temperature 4793.2476 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,793 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,793 K and log g 2.43 (u1 0.685, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
