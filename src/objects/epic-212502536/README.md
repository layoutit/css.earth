# EPIC 212502536

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.86 solar masses and 17.0 solar radii; APOGEE spectra give 4,354 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3621540716322923904, distance 4,666 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212502536 (K2 campaign 6): PARAM asteroseismic distance (pc) 4665.507812 (16th-84th percentiles 4572.1875-4786.367188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.201 ± 0.019 mas (10.4 standard errors), is not used. Radius 17.0274 +/- 0.6234 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212502536 (K2 campaign 6): PARAM radius (solar radii) 17.027434 (16th-84th percentiles 16.550392-17.797268), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8608 +/- 0.0672 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212502536 (K2 campaign 6): PARAM mass (solar masses) 0.860824 (16th-84th percentiles 0.813924-0.948314), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,354 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212502536: APOGEE DR17 effective temperature 4353.609 +/- 50 K (the catalogue's final uncertainty). log g 1.91 from the mass and radius.

**Colour.** A Planck spectrum at 4,354 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,354 K and log g 1.91 (u1 0.819, u2 0.002): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
