# EPIC 211959925

## Sources

Its oscillations, recorded in K2 campaign 16, give 1.04 solar masses and 15.9 solar radii; APOGEE spectra give 4,563 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 661152563874654208, distance 8,553 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211959925 (K2 campaign 16): PARAM asteroseismic distance (pc) 8552.734375 (16th-84th percentiles 8140.46875-8981.875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.152 ± 0.026 mas (5.9 standard errors), is not used. Radius 15.9018 +/- 1.0246 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211959925 (K2 campaign 16): PARAM radius (solar radii) 15.901752 (16th-84th percentiles 14.931346-16.980475), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0389 +/- 0.1505 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211959925 (K2 campaign 16): PARAM mass (solar masses) 1.038921 (16th-84th percentiles 0.901923-1.202848), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,563 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211959925: APOGEE DR17 effective temperature 4563.201 +/- 50 K (the catalogue's final uncertainty). log g 2.05 from the mass and radius.

**Colour.** A Planck spectrum at 4,563 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,563 K and log g 2.05 (u1 0.752, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
