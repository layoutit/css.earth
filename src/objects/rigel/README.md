# Rigel

Rigel is a blue supergiant about 265 parsecs away and roughly 79 times the Sun’s radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 3.78 ± 0.34 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Rigel, not two.

Radius: Radius 78.9 ± 7.4 solar radii from Moravveji et al. (2012), ApJ 747, 108, who combine the limb-darkened angular diameter 2.75 ± 0.01 mas of Aufdenberg et al. (2008) with the Hipparcos distance.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Rigel's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#bdcfff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). No limb darkening is drawn: the Claret & Bloemen (2011) model grid has no nodes at Rigel's low gravity (log g 1.75) for its temperature, and the colour is not extrapolated. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Kharitonov et al. (1988), record 342: Alma-Ata scans gives #b7c9ff, 6 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #bdcfff is the colour lens's prepared colour; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The distance rests on a 9 percent parallax, so the radius carries a 7.4 solar radii uncertainty. Rigel is a multiple system; this package is Rigel A only. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
