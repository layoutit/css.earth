# EPIC 220444120

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.86 solar masses and 10.9 solar radii; APOGEE spectra give 4,676 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2555942670007170816, distance 4,274 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220444120 (K2 campaign 8): PARAM asteroseismic distance (pc) 4274.335938 (16th-84th percentiles 4212.382812-4345.15625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.184 ± 0.021 mas (8.8 standard errors), is not used. Radius 10.9452 +/- 0.2259 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220444120 (K2 campaign 8): PARAM radius (solar radii) 10.945187 (16th-84th percentiles 10.757382-11.209203), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8648 +/- 0.0392 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220444120 (K2 campaign 8): PARAM mass (solar masses) 0.86477 (16th-84th percentiles 0.837003-0.915335), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,676 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220444120: APOGEE DR17 effective temperature 4675.8174 +/- 50 K (the catalogue's final uncertainty). log g 2.3 from the mass and radius.

**Colour.** A Planck spectrum at 4,676 K, because pARAM fits an extinction A_V = 0.20 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,676 K and log g 2.3 (u1 0.720, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
