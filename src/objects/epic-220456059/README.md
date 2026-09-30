# EPIC 220456059

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.84 solar masses and 13.4 solar radii; APOGEE spectra give 4,558 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2565121599234221056, distance 3,193 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220456059 (K2 campaign 8): PARAM asteroseismic distance (pc) 3192.695312 (16th-84th percentiles 3117.65625-3291.796875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.295 ± 0.016 mas (17.9 standard errors), is not used. Radius 13.3587 +/- 0.504 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220456059 (K2 campaign 8): PARAM radius (solar radii) 13.358742 (16th-84th percentiles 12.964721-13.972735), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8424 +/- 0.0709 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220456059 (K2 campaign 8): PARAM mass (solar masses) 0.842357 (16th-84th percentiles 0.790384-0.932209), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,558 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220456059: APOGEE DR17 effective temperature 4557.7197 +/- 50 K (the catalogue's final uncertainty). log g 2.11 from the mass and radius.

**Colour.** A Planck spectrum at 4,558 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,558 K and log g 2.11 (u1 0.754, u2 0.054): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
