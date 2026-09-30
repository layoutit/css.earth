# EPIC 211590863

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.98 solar masses and 11.4 solar radii; APOGEE spectra give 4,601 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 609471084962749696, distance 4,156 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211590863 (K2 campaign 5): PARAM asteroseismic distance (pc) 4156.289062 (16th-84th percentiles 4046.5625-4270.3125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.201 ± 0.018 mas (11.1 standard errors), is not used. Radius 11.3876 +/- 0.4595 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211590863 (K2 campaign 5): PARAM radius (solar radii) 11.387604 (16th-84th percentiles 10.959627-11.878634), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.977 +/- 0.0906 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211590863 (K2 campaign 5): PARAM mass (solar masses) 0.976978 (16th-84th percentiles 0.896636-1.077741), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,601 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211590863: APOGEE DR17 effective temperature 4601.246 +/- 50 K (the catalogue's final uncertainty). log g 2.32 from the mass and radius.

**Colour.** A Planck spectrum at 4,601 K, because pARAM fits an extinction A_V = 0.22 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,601 K and log g 2.32 (u1 0.744, u2 0.061): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
