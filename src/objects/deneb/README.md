# Deneb

Deneb is a white supergiant roughly 130 times the Sun’s radius, at a poorly known distance of about 433 parsecs. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 2.31 ± 0.32 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Deneb, not two.

Radius: Limb-darkened angular diameter 2.76 ± 0.06 mas from Aufdenberg et al. (2002), ApJ 570, 344: the NPOI uniform-disc diameter 2.40 ± 0.06 mas times a model limb-darkening correction of 1.15 for a star with a wind. At the Hipparcos distance this is the record’s radius.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Deneb's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ccdaff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 8600 K and log g 1.5: the edge is 38% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the spectroscopic mass 19 +/- 3 solar masses of Schiller & Przybilla 2008 (A&A 479, 849; https://arxiv.org/abs/0712.0040), abstract, and the package radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them.


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ccdaff is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The Hipparcos parallax is 2.31 ± 0.32 mas, a 14 percent uncertainty that carries straight into the radius. The limb-darkening correction is model dependent because Deneb has a wind. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
