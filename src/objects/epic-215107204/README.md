# EPIC 215107204

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.47 solar masses and 26.2 solar radii; APOGEE spectra give 4,428 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4074196085691260416, distance 8,062 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 215107204 (K2 campaign 7): PARAM asteroseismic distance (pc) 8061.796875 (16th-84th percentiles 7584.0625-8574.0625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.150 ± 0.018 mas (8.1 standard errors), is not used. Radius 26.1753 +/- 2.1613 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 215107204 (K2 campaign 7): PARAM radius (solar radii) 26.175268 (16th-84th percentiles 24.073684-28.396221), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4729 +/- 0.2579 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 215107204 (K2 campaign 7): PARAM mass (solar masses) 1.472933 (16th-84th percentiles 1.232718-1.748516), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,428 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 215107204: APOGEE DR17 effective temperature 4427.7437 +/- 50 K (the catalogue's final uncertainty). log g 1.77 from the mass and radius.

**Colour.** A Planck spectrum at 4,428 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,428 K and log g 1.77 (u1 0.793, u2 0.024): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
