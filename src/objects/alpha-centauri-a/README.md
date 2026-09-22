# Alpha Centauri A

Alpha Centauri A is the larger star of the nearest stellar system, 1.34 parsecs away and 1.22 times the Sun's radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the parallax 747.17 ± 0.61 mas that Kervella et al. (2017) adopt from Kervella et al. (2016). The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Alpha Centauri A, not two.

Radius: Limb-darkened angular diameter 8.502 ± 0.038 mas measured with VLTI/PIONIER by Kervella et al. (2017), A&A 597, A137, who derive 1.2234 ± 0.0053 solar radii with the parallax 747.17 ± 0.61 mas.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Alpha Centauri A's spectrum as Kiehling (1987) measured it from the ground, 320-880 nm with a relative calibration; the observation date is not published. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#fff5f4**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 5795 K and log g 4.31: the edge is 28% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g 4.3117 +/- 0.0015 from Kervella et al. 2017 (A&A 597, A137; https://arxiv.org/abs/1610.06185), Table 5, from the dynamical mass of Kervella et al. 2016. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Pulkovo spectrophotometric catalogue, table 6, HR 5459 (320-735 nm) gives #fff3ec, 8 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #fff5f4 is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

Alpha Centauri is a triple system; this package is component A only. No mass or gravitational parameter is adopted, and the pair's mutual orbit is not drawn.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
