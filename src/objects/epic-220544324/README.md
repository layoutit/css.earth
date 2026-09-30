# EPIC 220544324

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.89 solar masses and 10.6 solar radii; APOGEE spectra give 4,646 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2557199995913198208, distance 2,778 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220544324 (K2 campaign 8): PARAM asteroseismic distance (pc) 2777.8125 (16th-84th percentiles 2730.117188-2830.195312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.307 ± 0.014 mas (21.5 standard errors), is not used. Radius 10.6 +/- 0.3078 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220544324 (K2 campaign 8): PARAM radius (solar radii) 10.600035 (16th-84th percentiles 10.315586-10.931211), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8944 +/- 0.0562 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220544324 (K2 campaign 8): PARAM mass (solar masses) 0.894369 (16th-84th percentiles 0.851681-0.964076), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,646 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220544324: APOGEE DR17 effective temperature 4645.955 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,646 K, because pARAM fits an extinction A_V = 0.38 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,646 K and log g 2.34 (u1 0.730, u2 0.072): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
