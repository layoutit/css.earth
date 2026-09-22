# Fomalhaut

Fomalhaut is an A-type star 7.70 parsecs away and 1.84 times the Sun’s radius, known for its debris ring. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 129.81 ± 0.47 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Fomalhaut, not two.

Radius: Radius 1.842 ± 0.019 solar radii from Mamajek (2012), ApJ 754, L20, using the VLTI limb-darkened angular diameter 2.223 ± 0.022 mas.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Fomalhaut's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#c2d4ff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 8590 K and log g 4.19: the edge is 38% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the mass 1.92 +/- 0.02 solar masses of Mamajek 2012 (ApJL 754, L20; https://arxiv.org/abs/1206.6353), Table 2, and the package radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. No independent second spectrum covering the visible range was found; the closest, Davis & Webb (1974), has 24 points and was not used.


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #c2d4ff is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

Fomalhaut’s debris ring and companions are not drawn. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
