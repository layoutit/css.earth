# EPIC 205905919

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.91 solar masses and 7.8 solar radii; APOGEE spectra give 4,625 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6825778463090885888, distance 1,116 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205905919 (K2 campaign 3): PARAM asteroseismic distance (pc) 1115.742188 (16th-84th percentiles 1092.314453-1141.367188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.852 ± 0.016 mas (53.8 standard errors), is not used. Radius 7.8203 +/- 0.2048 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205905919 (K2 campaign 3): PARAM radius (solar radii) 7.820345 (16th-84th percentiles 7.633369-8.042903), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9127 +/- 0.0541 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205905919 (K2 campaign 3): PARAM mass (solar masses) 0.912719 (16th-84th percentiles 0.864252-0.972421), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,625 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205905919: APOGEE DR17 effective temperature 4624.541 +/- 50 K (the catalogue's final uncertainty). log g 2.61 from the mass and radius.

**Colour.** A Planck spectrum at 4,625 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,625 K and log g 2.61 (u1 0.741, u2 0.063): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
