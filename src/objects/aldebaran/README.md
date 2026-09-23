# Aldebaran

Aldebaran is a red giant 20.43 parsecs away and 44 times the Sun’s radius, measured as the Moon passed in front of it. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 48.94 ± 0.77 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Aldebaran, not two.

Radius: Limb-darkened angular diameter 20.58 ± 0.03 mas, or 44.2 ± 0.9 solar radii, from lunar occultations and VLTI/VINCI by Richichi and Roccatagliata (2005), A&A 433, 305.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Aldebaran's spectrum as Kiehling (1987) measured it from the ground, 320-880 nm with a relative calibration; the observation date is not published. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)): **#ffcb8d**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 3934 K and log g 1.21: the edge is 16% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the asteroseismic mass 1.16 +/- 0.07 solar masses of Farr et al. 2018 (ApJL 865, L20; https://arxiv.org/abs/1802.09812), abstract, and the package radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Burnashev (1985), record 456: a Crimean scan of 1977 gives #ffc887, 6 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #ffcb8d is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

No mass is adopted. The surface is a neutral sphere: no spots or limb darkening are shown.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
