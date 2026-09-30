# EPIC 247566075

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.21 solar masses and 20.1 solar radii; APOGEE spectra give 4,484 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3412521395515432448, distance 4,025 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247566075 (K2 campaign 13): PARAM asteroseismic distance (pc) 4025.351562 (16th-84th percentiles 3804.960938-4264.765625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.247 ± 0.017 mas (14.4 standard errors), is not used. Radius 20.094 +/- 1.5017 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247566075 (K2 campaign 13): PARAM radius (solar radii) 20.093966 (16th-84th percentiles 18.647601-21.650904), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2103 +/- 0.1972 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247566075 (K2 campaign 13): PARAM mass (solar masses) 1.210272 (16th-84th percentiles 1.028095-1.422572), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,484 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247566075: APOGEE DR17 effective temperature 4484.273 +/- 50 K (the catalogue's final uncertainty). log g 1.91 from the mass and radius.

**Colour.** A Planck spectrum at 4,484 K, because pARAM fits an extinction A_V = 1.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,484 K and log g 1.91 (u1 0.775, u2 0.039): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
