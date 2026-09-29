# EPIC 248095314

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.48 solar masses and 16.5 solar radii; APOGEE spectra give 4,572 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 148535263475584512, distance 2,616 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248095314 (K2 campaign 13): PARAM asteroseismic distance (pc) 2615.898438 (16th-84th percentiles 2510.878906-2723.945312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.284 ± 0.016 mas (17.9 standard errors), is not used. Radius 16.4878 +/- 0.9367 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248095314 (K2 campaign 13): PARAM radius (solar radii) 16.48776 (16th-84th percentiles 15.595357-17.468719), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4811 +/- 0.1894 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248095314 (K2 campaign 13): PARAM mass (solar masses) 1.481054 (16th-84th percentiles 1.306477-1.68527), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,572 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248095314: APOGEE DR17 effective temperature 4571.552 +/- 50 K (the catalogue's final uncertainty). log g 2.17 from the mass and radius.

**Colour.** A Planck spectrum at 4,572 K, because pARAM fits an extinction A_V = 1.84 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,572 K and log g 2.17 (u1 0.751, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
