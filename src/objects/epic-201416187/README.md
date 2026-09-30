# EPIC 201416187

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.86 solar masses and 15.5 solar radii; APOGEE spectra give 4,426 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3797139560866425984, distance 3,091 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201416187 (K2 campaign 1): PARAM asteroseismic distance (pc) 3091.171875 (16th-84th percentiles 3027.929688-3174.414062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.327 ± 0.016 mas (20.2 standard errors), is not used. Radius 15.5492 +/- 0.5072 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201416187 (K2 campaign 1): PARAM radius (solar radii) 15.549193 (16th-84th percentiles 15.152787-16.167277), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.865 +/- 0.0696 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201416187 (K2 campaign 1): PARAM mass (solar masses) 0.865037 (16th-84th percentiles 0.814573-0.953745), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,426 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201416187: APOGEE DR17 effective temperature 4426.335 +/- 50 K (the catalogue's final uncertainty). log g 1.99 from the mass and radius.

**Colour.** A Planck spectrum at 4,426 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,426 K and log g 1.99 (u1 0.795, u2 0.022): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
