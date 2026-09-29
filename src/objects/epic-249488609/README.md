# EPIC 249488609

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.72 solar masses and 13.9 solar radii; GALAH spectra give 5,277 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6231542112460838784, distance 2,710 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249488609 (K2 campaign 15): PARAM asteroseismic distance (pc) 2709.726562 (16th-84th percentiles 2590.039062-3035.9375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.482 ± 0.031 mas (15.8 standard errors), is not used. Radius 13.8991 +/- 1.2394 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249488609 (K2 campaign 15): PARAM radius (solar radii) 13.89908 (16th-84th percentiles 12.868324-15.347075), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.723 +/- 0.3539 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249488609 (K2 campaign 15): PARAM mass (solar masses) 1.72302 (16th-84th percentiles 1.4448-2.152693), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,277 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249488609: GALAH DR3 effective temperature 5276.798000000002 +/- 134 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Colour.** A Planck spectrum at 5,277 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffeada. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,277 K and log g 2.39 (u1 0.551, u2 0.200): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
