# EPIC 212708959

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.91 solar masses and 17.3 solar radii; APOGEE spectra give 4,811 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616089479406596352, distance 4,548 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212708959 (K2 campaign 6): PARAM asteroseismic distance (pc) 4547.890625 (16th-84th percentiles 4259.296875-4797.773438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.190 ± 0.016 mas (11.9 standard errors), is not used. Radius 17.3272 +/- 1.258 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212708959 (K2 campaign 6): PARAM radius (solar radii) 17.327158 (16th-84th percentiles 16.063714-18.579679), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9138 +/- 0.1474 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212708959 (K2 campaign 6): PARAM mass (solar masses) 0.913804 (16th-84th percentiles 0.763797-1.058675), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,811 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212708959: APOGEE DR17 effective temperature 4811.2134 +/- 50 K (the catalogue's final uncertainty). log g 1.92 from the mass and radius.

**Colour.** A Planck spectrum at 4,811 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,811 K and log g 1.92 (u1 0.674, u2 0.114): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
