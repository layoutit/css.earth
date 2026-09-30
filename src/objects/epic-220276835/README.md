# EPIC 220276835

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.87 solar masses and 11.8 solar radii; APOGEE spectra give 4,636 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2538649448046393984, distance 4,692 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220276835 (K2 campaign 8): PARAM asteroseismic distance (pc) 4692.03125 (16th-84th percentiles 4570.820312-4847.578125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.141 ± 0.021 mas (6.8 standard errors), is not used. Radius 11.75 +/- 0.4754 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220276835 (K2 campaign 8): PARAM radius (solar radii) 11.750035 (16th-84th percentiles 11.356729-12.307529), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8718 +/- 0.0816 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220276835 (K2 campaign 8): PARAM mass (solar masses) 0.87175 (16th-84th percentiles 0.80637-0.969523), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,636 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220276835: APOGEE DR17 effective temperature 4636.457 +/- 50 K (the catalogue's final uncertainty). log g 2.24 from the mass and radius.

**Colour.** A Planck spectrum at 4,636 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,636 K and log g 2.24 (u1 0.732, u2 0.071): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
