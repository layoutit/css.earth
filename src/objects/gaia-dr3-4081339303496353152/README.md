# Gaia DR3 4081339303496353152

## Sources

Gaia's parallax, brightness and spectrum give it 64.1 solar radii and 1.76 solar masses (FLAME) and 3,613 K at its surface (GSP-Phot). This account was drafted from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4081339303496353152, parallax 0.088 ± 0.014 mas (11325.80 pc). Radius 64.079 (58.285 to 71.273) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 1.765 (1.725 to 1.805) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 3,613 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 4081339303496353152: teff_gspphot 3613.032 K (16th-84th percentiles 3581.3313-3636.3853), the temperature FLAME used. log g 1.07 from the mass and radius.

**Colour.** A Planck spectrum at 3,613 K, because gSP-Phot fits an extinction A_G = 0.54 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the colour routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #ffca91. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,613 K and log g 1.07 (u1 1.041, u2 -0.191): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
