# EPIC 206065255

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.79 solar masses and 12.0 solar radii; APOGEE spectra give 4,925 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2612670529333211904, distance 2,459 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206065255 (K2 campaign 3): PARAM asteroseismic distance (pc) 2459.140625 (16th-84th percentiles 2424.589844-2498.554688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.412 ± 0.021 mas (20.1 standard errors), is not used. Radius 12.0273 +/- 0.2841 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206065255 (K2 campaign 3): PARAM radius (solar radii) 12.027286 (16th-84th percentiles 11.779224-12.347406), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.792 +/- 0.0432 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206065255 (K2 campaign 3): PARAM mass (solar masses) 0.792013 (16th-84th percentiles 0.757006-0.843496), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,925 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206065255: APOGEE DR17 effective temperature 4924.819 +/- 50 K (the catalogue's final uncertainty). log g 2.18 from the mass and radius.

**Colour.** A Planck spectrum at 4,925 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,925 K and log g 2.18 (u1 0.643, u2 0.137): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
