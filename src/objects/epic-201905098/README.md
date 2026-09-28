# EPIC 201905098

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.17 solar masses and 9.9 solar radii; APOGEE spectra give 5,350 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3913647974769304960, distance 4,313 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201905098 (K2 campaign 1): PARAM asteroseismic distance (pc) 4312.734375 (16th-84th percentiles 4155.703125-4466.25), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.226 ± 0.017 mas (13.3 standard errors), is not used. Radius 9.9138 +/- 0.636 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201905098 (K2 campaign 1): PARAM radius (solar radii) 9.913831 (16th-84th percentiles 9.020232-10.292249), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1736 +/- 0.1636 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201905098 (K2 campaign 1): PARAM mass (solar masses) 1.173571 (16th-84th percentiles 0.963339-1.290561), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,350 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201905098: APOGEE DR17 effective temperature 5349.703 +/- 181 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 5,350 K, because pARAM fits an extinction A_V = 0.49 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffebdc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,350 K and log g 2.52 (u1 0.533, u2 0.212): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
