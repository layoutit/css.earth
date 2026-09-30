# EPIC 246233006

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.92 solar masses and 7.9 solar radii; APOGEE spectra give 4,681 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2635619325574120064, distance 3,142 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246233006 (K2 campaign 12): PARAM asteroseismic distance (pc) 3142.226562 (16th-84th percentiles 3047.460938-3243.007812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.327 ± 0.024 mas (13.4 standard errors), is not used. Radius 7.9135 +/- 0.2849 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246233006 (K2 campaign 12): PARAM radius (solar radii) 7.913505 (16th-84th percentiles 7.652014-8.221775), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9181 +/- 0.0815 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246233006 (K2 campaign 12): PARAM mass (solar masses) 0.918107 (16th-84th percentiles 0.844714-1.007729), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,681 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246233006: APOGEE DR17 effective temperature 4681.044 +/- 50 K (the catalogue's final uncertainty). log g 2.6 from the mass and radius.

**Colour.** A Planck spectrum at 4,681 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,681 K and log g 2.6 (u1 0.723, u2 0.077): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
