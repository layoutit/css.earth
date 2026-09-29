# EPIC 212022795

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.86 solar masses and 9.8 solar radii; APOGEE spectra give 4,955 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 663936252438987648, distance 3,603 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212022795 (K2 campaign 16): PARAM asteroseismic distance (pc) 3602.773438 (16th-84th percentiles 3519.53125-3689.921875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.232 ± 0.015 mas (15.4 standard errors), is not used. Radius 9.7615 +/- 0.2999 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212022795 (K2 campaign 16): PARAM radius (solar radii) 9.761476 (16th-84th percentiles 9.500257-10.100071), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8621 +/- 0.0671 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212022795 (K2 campaign 16): PARAM mass (solar masses) 0.862113 (16th-84th percentiles 0.806207-0.940503), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,955 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212022795: APOGEE DR17 effective temperature 4954.5654 +/- 50 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Colour.** A Planck spectrum at 4,955 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,955 K and log g 2.39 (u1 0.636, u2 0.142): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
