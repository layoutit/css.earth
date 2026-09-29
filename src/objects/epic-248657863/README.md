# EPIC 248657863

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.92 solar masses and 10.8 solar radii; APOGEE spectra give 4,887 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3863169773895024000, distance 5,988 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248657863 (K2 campaign 14): PARAM asteroseismic distance (pc) 5987.890625 (16th-84th percentiles 5776.40625-6210.625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.117 ± 0.023 mas (5.0 standard errors), is not used. Radius 10.7531 +/- 0.5279 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248657863 (K2 campaign 14): PARAM radius (solar radii) 10.753104 (16th-84th percentiles 10.241978-11.297717), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9225 +/- 0.1069 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248657863 (K2 campaign 14): PARAM mass (solar masses) 0.922535 (16th-84th percentiles 0.82216-1.035976), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,887 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248657863: APOGEE DR17 effective temperature 4886.9536 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,887 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,887 K and log g 2.34 (u1 0.656, u2 0.127): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
