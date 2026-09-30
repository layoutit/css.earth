# EPIC 203791956

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.85 solar masses and 19.3 solar radii; APOGEE spectra give 4,310 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6049765627480555008, distance 6,002 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203791956 (K2 campaign 2): PARAM asteroseismic distance (pc) 6001.5625 (16th-84th percentiles 5883.828125-6150.390625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.164 ± 0.020 mas (8.3 standard errors), is not used. Radius 19.3241 +/- 0.705 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203791956 (K2 campaign 2): PARAM radius (solar radii) 19.324134 (16th-84th percentiles 18.782268-20.192328), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8459 +/- 0.0638 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203791956 (K2 campaign 2): PARAM mass (solar masses) 0.845881 (16th-84th percentiles 0.802526-0.930106), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,310 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203791956: APOGEE DR17 effective temperature 4310.0444 +/- 50 K (the catalogue's final uncertainty). log g 1.79 from the mass and radius.

**Colour.** A Planck spectrum at 4,310 K, because pARAM fits an extinction A_V = 0.56 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,310 K and log g 1.79 (u1 0.833, u2 -0.009): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
