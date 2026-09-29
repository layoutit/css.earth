# EPIC 220299642

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.92 solar masses and 9.1 solar radii; APOGEE spectra give 4,510 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2538771665635664512, distance 3,802 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220299642 (K2 campaign 8): PARAM asteroseismic distance (pc) 3802.1875 (16th-84th percentiles 3722.109375-3898.710938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.229 ± 0.025 mas (9.1 standard errors), is not used. Radius 9.1197 +/- 0.2798 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220299642 (K2 campaign 8): PARAM radius (solar radii) 9.11974 (16th-84th percentiles 8.89156-9.451131), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9215 +/- 0.0679 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220299642 (K2 campaign 8): PARAM mass (solar masses) 0.92148 (16th-84th percentiles 0.868109-1.003871), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,510 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220299642: APOGEE DR17 effective temperature 4509.938 +/- 50 K (the catalogue's final uncertainty). log g 2.48 from the mass and radius.

**Colour.** A Planck spectrum at 4,510 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,510 K and log g 2.48 (u1 0.776, u2 0.035): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
