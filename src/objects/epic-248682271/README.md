# EPIC 248682271

## Sources

Its oscillations, recorded in K2 campaign 14, give 2.86 solar masses and 18.2 solar radii; APOGEE spectra give 5,106 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3863589237580794752, distance 8,336 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248682271 (K2 campaign 14): PARAM asteroseismic distance (pc) 8336.40625 (16th-84th percentiles 8184.21875-8464.140625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.182 ± 0.017 mas (10.9 standard errors), is not used. Radius 18.1964 +/- 0.3585 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248682271 (K2 campaign 14): PARAM radius (solar radii) 18.196409 (16th-84th percentiles 17.745249-18.462192), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.8564 +/- 0.1191 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248682271 (K2 campaign 14): PARAM mass (solar masses) 2.856367 (16th-84th percentiles 2.698597-2.936817), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,106 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248682271: APOGEE DR17 effective temperature 5105.826 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,106 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,106 K and log g 2.37 (u1 0.595, u2 0.170): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
