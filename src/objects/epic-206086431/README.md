# EPIC 206086431

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.74 solar masses and 11.9 solar radii; APOGEE spectra give 4,904 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2613316664213390464, distance 3,062 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206086431 (K2 campaign 3): PARAM asteroseismic distance (pc) 3062.109375 (16th-84th percentiles 3009.6875-3124.570312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.282 ± 0.017 mas (16.2 standard errors), is not used. Radius 11.9111 +/- 0.3752 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206086431 (K2 campaign 3): PARAM radius (solar radii) 11.911105 (16th-84th percentiles 11.622926-12.373371), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7362 +/- 0.0537 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206086431 (K2 campaign 3): PARAM mass (solar masses) 0.736243 (16th-84th percentiles 0.697765-0.805228), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,904 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206086431: APOGEE DR17 effective temperature 4903.515 +/- 50 K (the catalogue's final uncertainty). log g 2.15 from the mass and radius.

**Colour.** A Planck spectrum at 4,904 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,904 K and log g 2.15 (u1 0.649, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
