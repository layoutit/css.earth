# K2-18

K2-18 is a red dwarf 38 parsecs away, about four tenths of the Sun’s radius. Its planet K2-18 b circles it every 33 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 26.2469 ± 0.0266 mas via SIMBAD. K2-18 has no Hipparcos number, so it matches no entry of the shared star field; the package places it from the astrometry above.

Radius: Stellar radius 0.4445 ± 0.0148 solar radii from Benneke et al. (2019, ApJL 887, L14; arXiv:1909.04642), Table 1, which revises the discovery-era 0.411 ± 0.038 (Sarkis et al. 2018, from Benneke et al. 2017) using the Gaia DR2 distance. It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: Sarkis et al. 2018 measure a 39.63 ± 0.50 day rotation period from photometry; no spin axis is measured, so none is adopted. The display axis is celestial north at the star, a convention.

Colour lens: The colour of K2-18's LAMOST spectrum. The LAMOST survey telescope observed it on 21 March 2014, with a relative flux calibration and a fibre warning in the file. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ffc796**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from PHOENIX model atmospheres, read at 3457 K and log g 4.77: the edge is 17% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the astronomy record's GM and radius (physicalNotes), log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: LAMOST DR11 spectrum 400516214 (2016-01-04): the same survey on another night, not a different instrument gives #ffcb9a, 4 levels from the lens colour in its most different channel (the threshold for agreement is 12).


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffc796 is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
