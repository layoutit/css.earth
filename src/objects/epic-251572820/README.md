# EPIC 251572820

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.85 solar masses and 7.3 solar radii; APOGEE spectra give 4,783 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3638281437985825280, distance 3,176 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251572820 (K2 campaign 17): PARAM asteroseismic distance (pc) 3175.507812 (16th-84th percentiles 3108.320312-3257.226562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.295 ± 0.020 mas (14.5 standard errors), is not used. Radius 7.3048 +/- 0.2086 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251572820 (K2 campaign 17): PARAM radius (solar radii) 7.304763 (16th-84th percentiles 7.128079-7.545232), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8492 +/- 0.0595 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251572820 (K2 campaign 17): PARAM mass (solar masses) 0.849232 (16th-84th percentiles 0.799998-0.918954), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,783 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251572820: APOGEE DR17 effective temperature 4782.8545 +/- 50 K (the catalogue's final uncertainty). log g 2.64 from the mass and radius.

**Colour.** A Planck spectrum at 4,783 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,783 K and log g 2.64 (u1 0.691, u2 0.102): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
