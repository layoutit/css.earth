# EPIC 220179594

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.99 solar masses and 4.6 solar radii; APOGEE spectra give 4,832 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2535941694504552192, distance 1,453 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220179594 (K2 campaign 8): PARAM asteroseismic distance (pc) 1452.753906 (16th-84th percentiles 1415.839844-1490.46875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.632 ± 0.016 mas (38.6 standard errors), is not used. Radius 4.5912 +/- 0.1415 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220179594 (K2 campaign 8): PARAM radius (solar radii) 4.591187 (16th-84th percentiles 4.453881-4.736895), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9908 +/- 0.0734 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220179594 (K2 campaign 8): PARAM mass (solar masses) 0.990776 (16th-84th percentiles 0.920754-1.067551), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,832 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220179594: APOGEE DR17 effective temperature 4832.2534 +/- 50 K (the catalogue's final uncertainty). log g 3.11 from the mass and radius.

**Colour.** A Planck spectrum at 4,832 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,832 K and log g 3.11 (u1 0.684, u2 0.105): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
