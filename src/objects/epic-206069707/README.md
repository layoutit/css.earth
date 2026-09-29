# EPIC 206069707

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.86 solar masses and 8.4 solar radii; APOGEE spectra give 4,686 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2601101639784263040, distance 3,363 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069707 (K2 campaign 3): PARAM asteroseismic distance (pc) 3363.4375 (16th-84th percentiles 3287.773438-3453.75), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.270 ± 0.020 mas (13.6 standard errors), is not used. Radius 8.3918 +/- 0.2681 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069707 (K2 campaign 3): PARAM radius (solar radii) 8.391763 (16th-84th percentiles 8.168374-8.704489), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.861 +/- 0.0657 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069707 (K2 campaign 3): PARAM mass (solar masses) 0.860998 (16th-84th percentiles 0.809358-0.940788), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,686 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069707: APOGEE DR17 effective temperature 4686.16 +/- 50 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,686 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,686 K and log g 2.53 (u1 0.720, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
