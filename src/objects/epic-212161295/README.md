# EPIC 212161295

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.01 solar masses and 11.7 solar radii; APOGEE spectra give 4,352 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 678131497309433728, distance 1,812 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212161295 (K2 campaign 5): PARAM asteroseismic distance (pc) 1811.484375 (16th-84th percentiles 1752.851562-1880.761719), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.528 ± 0.015 mas (34.8 standard errors), is not used. Radius 11.6586 +/- 0.5002 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212161295 (K2 campaign 5): PARAM radius (solar radii) 11.658649 (16th-84th percentiles 11.222968-12.223331), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0065 +/- 0.0992 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212161295 (K2 campaign 5): PARAM mass (solar masses) 1.006511 (16th-84th percentiles 0.92136-1.119734), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,352 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212161295: APOGEE DR17 effective temperature 4352.1113 +/- 50 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Colour.** A Planck spectrum at 4,352 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,352 K and log g 2.31 (u1 0.824, u2 -0.003): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
