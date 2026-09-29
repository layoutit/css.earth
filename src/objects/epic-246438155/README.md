# EPIC 246438155

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.04 solar masses and 9.4 solar radii; APOGEE spectra give 4,794 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2651175804495244032, distance 3,529 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246438155 (K2 campaign 12): PARAM asteroseismic distance (pc) 3529.140625 (16th-84th percentiles 3416.484375-3644.140625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.268 ± 0.017 mas (15.9 standard errors), is not used. Radius 9.4045 +/- 0.397 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246438155 (K2 campaign 12): PARAM radius (solar radii) 9.404453 (16th-84th percentiles 9.015522-9.809502), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0432 +/- 0.1057 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246438155 (K2 campaign 12): PARAM mass (solar masses) 1.043176 (16th-84th percentiles 0.942457-1.153766), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,794 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246438155: APOGEE DR17 effective temperature 4794.314 +/- 50 K (the catalogue's final uncertainty). log g 2.51 from the mass and radius.

**Colour.** A Planck spectrum at 4,794 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,794 K and log g 2.51 (u1 0.686, u2 0.106): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
