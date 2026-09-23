# HD 209458

HD 209458 is a Sun-like star 48 parsecs away in Pegasus, 1.16 times the Sun’s radius. Its giant planet crosses its face every 3.5 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 20.7694 ± 0.0266 mas via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, HIP 108859, so there is one HD 209458, not two.

Radius: Stellar radius 1.155 +0.014 −0.016 solar radii from Torres et al. 2008, ApJ 677, 1324 (2008). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted. The display axis is celestial north at the star, a convention.

**Colour lens.** The colour of the Hubble Space Telescope's calibrated STIS spectrum of HD 209458, a CALSPEC flux standard. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)): **#fef9ff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic law Brown et al. (2001, ApJ 552, 699, Table 1) fitted to Hubble STIS transits of HD 209458b at 581-638 nm: u1 = 0.29 and u2 = 0.35, each ± 0.05, solved from the published sum 0.640 ± 0.030 and difference -0.055 ± 0.100 ([brown-2001-limb-darkening.json](source/photometry/brown-2001-limb-darkening.json)). The edge is 36% as bright as the centre, a measurement of this star. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Gaia DR3 XP spectrum, source 1779546757669063552 gives #fcf6ff, 3 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #fef9ff is the colour lens's prepared colour; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
