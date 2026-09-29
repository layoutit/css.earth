# EPIC 213410543

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.83 solar masses and 19.3 solar radii; APOGEE spectra give 4,976 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6759357309261314560, distance 7,725 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213410543 (K2 campaign 7): PARAM asteroseismic distance (pc) 7725.390625 (16th-84th percentiles 7568.359375-7957.265625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.098 ± 0.021 mas (4.6 standard errors), is not used. Radius 19.262 +/- 0.8065 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213410543 (K2 campaign 7): PARAM radius (solar radii) 19.261983 (16th-84th percentiles 18.67131-20.284344), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.8255 +/- 0.1686 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213410543 (K2 campaign 7): PARAM mass (solar masses) 1.82554 (16th-84th percentiles 1.70857-2.045688), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,976 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213410543: APOGEE DR17 effective temperature 4976.0273 +/- 50 K (the catalogue's final uncertainty). log g 2.13 from the mass and radius.

**Colour.** A Planck spectrum at 4,976 K, because pARAM fits an extinction A_V = 0.56 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,976 K and log g 2.13 (u1 0.628, u2 0.148): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
