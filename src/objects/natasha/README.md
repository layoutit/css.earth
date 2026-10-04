# Natasha

## Sources

Gaia's parallax, brightness and spectrum give it 0.8 solar radii and 0.81 solar masses (FLAME) and 5,085 K at its surface (GSP-Phot). It is also HD 85390, HIP 48235. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5406324138654973824, parallax 29.827 ± 0.015 mas (33.53 pc). Radius 0.837 (0.820 to 0.855) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 0.811 (0.771 to 0.851) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 5,085 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 5406324138654973824: teff_gspphot 5085.374 K (16th-84th percentiles 5084.5425-5086.242), the temperature FLAME used. log g 4.5 from the mass and radius.

**Color.** A Planck spectrum at 5,085 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #ffe7d3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,085 K and log g 4.5 (u1 0.633, u2 0.139): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 85390" (revision 1371881643) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
