# EPIC 212346061

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.81 solar masses and 9.8 solar radii; APOGEE spectra give 4,970 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3605273239926763648, distance 5,591 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212346061 (K2 campaign 6): PARAM asteroseismic distance (pc) 5590.9375 (16th-84th percentiles 5522.890625-5668.671875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.166 ± 0.024 mas (6.9 standard errors), is not used. Radius 9.7877 +/- 0.1693 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212346061 (K2 campaign 6): PARAM radius (solar radii) 9.787662 (16th-84th percentiles 9.63803-9.976539), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8063 +/- 0.028 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212346061 (K2 campaign 6): PARAM mass (solar masses) 0.806253 (16th-84th percentiles 0.784365-0.840284), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,970 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212346061: APOGEE DR17 effective temperature 4969.5273 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,970 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,970 K and log g 2.36 (u1 0.632, u2 0.145): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
