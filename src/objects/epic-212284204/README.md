# EPIC 212284204

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.10 solar masses and 7.3 solar radii; APOGEE spectra give 4,680 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6294130471841325312, distance 2,532 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212284204 (K2 campaign 6): PARAM asteroseismic distance (pc) 2532.03125 (16th-84th percentiles 2460.507812-2605.625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.370 ± 0.019 mas (19.8 standard errors), is not used. Radius 7.2985 +/- 0.2649 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212284204 (K2 campaign 6): PARAM radius (solar radii) 7.298505 (16th-84th percentiles 7.039981-7.569804), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0983 +/- 0.0956 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212284204 (K2 campaign 6): PARAM mass (solar masses) 1.098314 (16th-84th percentiles 1.007766-1.198876), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,680 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212284204: APOGEE DR17 effective temperature 4679.727 +/- 50 K (the catalogue's final uncertainty). log g 2.75 from the mass and radius.

**Colour.** A Planck spectrum at 4,680 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,680 K and log g 2.75 (u1 0.725, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
