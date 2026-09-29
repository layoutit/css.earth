# EPIC 247590565

## Sources

Its oscillations, recorded in K2 campaign 13, give 0.94 solar masses and 11.4 solar radii; APOGEE spectra give 4,643 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418344718334418560, distance 4,181 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247590565 (K2 campaign 13): PARAM asteroseismic distance (pc) 4180.46875 (16th-84th percentiles 4015.898438-4361.5625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.231 ± 0.034 mas (6.7 standard errors), is not used. Radius 11.3506 +/- 0.5384 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247590565 (K2 campaign 13): PARAM radius (solar radii) 11.350568 (16th-84th percentiles 10.860741-11.937617), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9447 +/- 0.1042 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247590565 (K2 campaign 13): PARAM mass (solar masses) 0.944684 (16th-84th percentiles 0.85297-1.06131), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,643 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247590565: APOGEE DR17 effective temperature 4643.3213 +/- 50 K (the catalogue's final uncertainty). log g 2.3 from the mass and radius.

**Colour.** A Planck spectrum at 4,643 K, because pARAM fits an extinction A_V = 1.36 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,643 K and log g 2.3 (u1 0.730, u2 0.072): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
