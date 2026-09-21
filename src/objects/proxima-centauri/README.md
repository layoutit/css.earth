# Proxima Centauri

Proxima Centauri is a red dwarf 1.30 parsecs away, the closest known star to the Sun, about one seventh of its radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 768.0665 ± 0.0499 mas via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Proxima Centauri, not two.

Radius: Radius 0.141 ± 0.007 solar radii measured with VLTI/AMBER by Demory et al. (2009), A&A 505, 205. Kervella, Thévenin and Lovis (2017) give 0.1542 ± 0.0045 from a radius to magnitude relation; the interferometric value is adopted.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of Proxima Centauri's VLT/X-shooter spectrum. ESO's Very Large Telescope observed it on 15 January 2014; Proxima flares, so this is one moment. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ffc073**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). No limb darkening is drawn: Proxima's gravity (log g about 5.2) is above the Claret & Bloemen (2011) model grid, and the law is not extrapolated. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them.


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffc073 is the colour lens's prepared colour; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

Proxima is a flare star with a planet, Proxima b; neither flares nor the planet are drawn. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
