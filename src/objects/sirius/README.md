# Sirius

Sirius A is an A-type star 2.64 parsecs from the Sun and about 1.7 times its radius. The VLTI measured its disc at 6.04 milliarcseconds; here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 379.21 ± 1.58 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Sirius, not two.

Radius: Limb-darkened angular diameter 6.039 ± 0.019 mas measured on Sirius A with VLTI/VINCI by Kervella et al. (2003), A&A 408, 681; at 2.6371 pc this is the record's radius.

Rotation: no rotation axis or period is adopted for Sirius A in the sources used here: Kervella et al. 2003 and the SIMBAD record The display axis is celestial north at the star, a convention.

Colour lens: The colour of the Hubble Space Telescope's calibrated STIS spectrum of Sirius A, the CALSPEC flux standard. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#b3c8ff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 9845 K and log g 4.29: the edge is 44% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the dynamical mass 2.063 +/- 0.023 solar masses of Bond et al. 2017 (arXiv:1703.10625, abstract; https://arxiv.org/abs/1703.10625) and the package radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Pulkovo spectrophotometric catalogue, HR 2491: ground-based scans, independent of Hubble gives #b5cbff, 3 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #b3c8ff is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

Sirius is a binary. This package is Sirius A only; the white dwarf Sirius B is not represented. No mass or gravitational parameter is adopted. The surface is a neutral sphere: no spots, limb darkening map or resolved image is shown.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
