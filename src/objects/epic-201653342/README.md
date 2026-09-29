# EPIC 201653342

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.95 solar masses and 10.0 solar radii; APOGEE spectra give 5,037 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3811588556699979008, distance 3,881 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201653342 (K2 campaign 14): PARAM asteroseismic distance (pc) 3881.328125 (16th-84th percentiles 3828.007812-3941.210938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.215 ± 0.016 mas (13.1 standard errors), is not used. Radius 9.9954 +/- 0.1682 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201653342 (K2 campaign 14): PARAM radius (solar radii) 9.995406 (16th-84th percentiles 9.834295-10.17066), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9517 +/- 0.0329 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201653342 (K2 campaign 14): PARAM mass (solar masses) 0.951741 (16th-84th percentiles 0.925716-0.991498), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,037 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201653342: APOGEE DR17 effective temperature 5036.9766 +/- 50 K (the catalogue's final uncertainty). log g 2.42 from the mass and radius.

**Colour.** A Planck spectrum at 5,037 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,037 K and log g 2.42 (u1 0.614, u2 0.158): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
