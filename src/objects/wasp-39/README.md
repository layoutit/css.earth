# WASP-39

WASP-39 is a Sun-like star about 215 parsecs away, 0.94 times the Sun’s radius. Its giant planet WASP-39 b circles it every four days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 4.6435 ± 0.0144 mas via SIMBAD. WASP-39 has no Hipparcos number, so it matches no entry of the shared star field; the package places it from the astrometry above.

Radius: Stellar radius 0.939 ± 0.019 ± 0.011 solar radii from Mancini et al. 2018, A&A 613, A41 (2018). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted. The display axis is celestial north at the star, a convention.

Colour lens: The colour of Gaia DR3's measured spectrum of WASP-39. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ffebdf**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic law Kirk et al. (2019, AJ 158, 144, Table 1) fitted to WHT/ACAM transits of WASP-39b at 400-900 nm: u1 = 0.49 ± 0.06 measured, with u2 = 0.08 held at a model atmosphere value in their fit, so the law is half measured ([kirk-2019-limb-darkening.json](source/photometry/kirk-2019-limb-darkening.json)). The edge is 43% as bright as the centre. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. A second spectrum exists but is not yet used: two HST STIS exposures (programme 12473) that would have to be joined at 560 nm.


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffebdf is the colour lens's prepared colour; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
