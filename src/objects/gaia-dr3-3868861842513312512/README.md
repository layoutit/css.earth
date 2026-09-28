# Gaia DR3 3868861842513312512

## Sources

Gaia's parallax, brightness and spectrum give it 23.8 solar radii and 3.50 solar masses (FLAME) and 4,556 K at its surface (GSP-Phot). This account was drafted from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3868861842513312512, parallax 0.125 ± 0.015 mas (8028.37 pc). Radius 23.847 (22.411 to 25.784) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 3.504 (3.464 to 3.706) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 4,556 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 3868861842513312512: teff_gspphot 4556.3193 K (16th-84th percentiles 4513.2363-4568.9736), the temperature FLAME used. log g 2.23 from the mass and radius.

**Colour.** A Planck spectrum at 4,556 K, because gSP-Phot fits an extinction A_G = 0.20 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the colour routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,556 K and log g 2.23 (u1 0.757, u2 0.052): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
