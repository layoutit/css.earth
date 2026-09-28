# Gaia DR3 4702120338712278400

## Sources

Gaia's parallax, brightness and spectrum give it 34.1 solar radii and 4.20 solar masses (FLAME) and 4,327 K at its surface (GSP-Phot). This account was drafted from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4702120338712278400, parallax 0.073 ± 0.011 mas (13714.18 pc). Radius 34.144 (31.102 to 37.828) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 4.203 (4.093 to 4.405) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 4,327 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 4702120338712278400: teff_gspphot 4326.617 K (16th-84th percentiles 4322.581-4331.308), the temperature FLAME used. log g 1.99 from the mass and radius.

**Colour.** A Planck spectrum at 4,327 K, because gSP-Phot fits an extinction A_G = 0.15 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the colour routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,327 K and log g 1.99 (u1 0.828, u2 -0.006): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
