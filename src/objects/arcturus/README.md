# Arcturus

Arcturus is a red giant 11.26 parsecs away, about 25 times the Sun’s radius. Interferometers have measured its disc; here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 88.83 ± 0.54 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Arcturus, not two.

Radius: Limb-darkened angular diameter 20.922 ± 0.036 mas (quadratic limb-darkening fit) measured with IOTA/IONIC by Lacour et al. (2008), A&A 485, 561; at the Hipparcos distance this is the record’s radius.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Arcturus's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ffd8a5**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 4295 K and log g 1.66: the edge is 18% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g 1.66 +/- 0.05 measured by Ramirez & Allende Prieto 2011 (ApJ 743, 135; https://arxiv.org/abs/1109.4425), abstract. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Kiehling (1987), HR 5340: an independent ground-based scan gives #ffdab0, 11 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffd8a5 is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The cited paper images Arcturus’s limb darkening; this package shows a neutral sphere and does not cast that image. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
