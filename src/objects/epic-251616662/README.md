# EPIC 251616662

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.01 solar masses and 7.3 solar radii; APOGEE spectra give 4,787 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3686773160650218624, distance 3,367 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251616662 (K2 campaign 17): PARAM asteroseismic distance (pc) 3367.070312 (16th-84th percentiles 3265.703125-3469.84375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.300 ± 0.022 mas (14.0 standard errors), is not used. Radius 7.2983 +/- 0.2766 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251616662 (K2 campaign 17): PARAM radius (solar radii) 7.29832 (16th-84th percentiles 7.028029-7.581324), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.015 +/- 0.0921 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251616662 (K2 campaign 17): PARAM mass (solar masses) 1.014954 (16th-84th percentiles 0.927177-1.111402), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,787 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251616662: APOGEE DR17 effective temperature 4787.2524 +/- 50 K (the catalogue's final uncertainty). log g 2.72 from the mass and radius.

**Colour.** A Planck spectrum at 4,787 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,787 K and log g 2.72 (u1 0.691, u2 0.101): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
