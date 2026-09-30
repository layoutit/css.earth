# EPIC 220634712

## Sources

Its oscillations, recorded in K2 campaign 8, give 2.91 solar masses and 18.1 solar radii; APOGEE spectra give 5,188 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2579877732473754368, distance 5,405 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634712 (K2 campaign 8): PARAM asteroseismic distance (pc) 5405.234375 (16th-84th percentiles 5346.25-5461.640625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.418 ± 0.022 mas (18.7 standard errors), is not used. Radius 18.0786 +/- 0.2531 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634712 (K2 campaign 8): PARAM radius (solar radii) 18.078557 (16th-84th percentiles 17.777928-18.284112), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.908 +/- 0.0897 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634712 (K2 campaign 8): PARAM mass (solar masses) 2.908023 (16th-84th percentiles 2.767763-2.947182), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,188 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634712: APOGEE DR17 effective temperature 5187.977 +/- 50 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Colour.** A Planck spectrum at 5,188 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe9d6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,188 K and log g 2.39 (u1 0.574, u2 0.185): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
