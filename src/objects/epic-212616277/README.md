# EPIC 212616277

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.75 solar masses and 19.8 solar radii; APOGEE spectra give 4,608 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3615311918527187328, distance 7,781 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212616277 (K2 campaign 6): PARAM asteroseismic distance (pc) 7780.546875 (16th-84th percentiles 7620.9375-7981.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.074 ± 0.022 mas (3.4 standard errors), is not used. Radius 19.7684 +/- 0.7495 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212616277 (K2 campaign 6): PARAM radius (solar radii) 19.768356 (16th-84th percentiles 19.198899-20.697828), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7543 +/- 0.0589 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212616277 (K2 campaign 6): PARAM mass (solar masses) 0.754295 (16th-84th percentiles 0.716542-0.834381), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,608 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212616277: APOGEE DR17 effective temperature 4608.418 +/- 50 K (the catalogue's final uncertainty). log g 1.72 from the mass and radius.

**Colour.** A Planck spectrum at 4,608 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,608 K and log g 1.72 (u1 0.734, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
