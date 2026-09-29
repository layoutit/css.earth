# EPIC 211385716

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.92 solar masses and 10.0 solar radii; APOGEE spectra give 4,723 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 598896458867311104, distance 2,239 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211385716 (K2 campaign 5): PARAM asteroseismic distance (pc) 2239.335938 (16th-84th percentiles 2165.78125-2322.695312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.422 ± 0.017 mas (24.8 standard errors), is not used. Radius 10.0456 +/- 0.4147 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211385716 (K2 campaign 5): PARAM radius (solar radii) 10.045642 (16th-84th percentiles 9.674083-10.503569), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9165 +/- 0.091 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211385716 (K2 campaign 5): PARAM mass (solar masses) 0.916451 (16th-84th percentiles 0.838066-1.020003), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,723 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211385716: APOGEE DR17 effective temperature 4723.1274 +/- 50 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Colour.** A Planck spectrum at 4,723 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,723 K and log g 2.4 (u1 0.706, u2 0.091): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
