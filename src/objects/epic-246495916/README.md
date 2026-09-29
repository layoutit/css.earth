# EPIC 246495916

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.82 solar masses and 8.2 solar radii; APOGEE spectra give 4,709 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2645824786344718336, distance 1,574 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246495916 (K2 campaign 12): PARAM asteroseismic distance (pc) 1574.0625 (16th-84th percentiles 1552.050781-1597.089844), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.618 ± 0.015 mas (40.7 standard errors), is not used. Radius 8.246 +/- 0.1569 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246495916 (K2 campaign 12): PARAM radius (solar radii) 8.245979 (16th-84th percentiles 8.116913-8.430736), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8198 +/- 0.0334 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246495916 (K2 campaign 12): PARAM mass (solar masses) 0.819798 (16th-84th percentiles 0.794596-0.861472), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,709 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246495916: APOGEE DR17 effective temperature 4709.425 +/- 50 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 4,709 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,709 K and log g 2.52 (u1 0.712, u2 0.086): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
