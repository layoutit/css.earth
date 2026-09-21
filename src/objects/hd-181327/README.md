# HD 181327

## Sources

- **Placement:** Gaia DR3 source 6643589352010758400 (`source/photometry/gaia-dr3-source.csv`): ICRS position at J2016.0, parallax 20.931 ± 0.029 mas (47.78 pc, no zero-point correction), proper motion and radial velocity, propagated to the scene epoch by `@cssearth/astronomy`.
- **Radius and mass:** the Gaia DR3 FLAME values of the same source (`source/photometry/gaia-dr3-astrophysical-parameters.csv`): 1.372 solar radii (1.344–1.400) and 1.231 solar masses (1.191–1.271); Creevey et al. (2023, A&A 674, A26), Fouesneau et al. (2023, A&A 674, A28). GSP-Phot gives 1.376 solar radii and 6375 K in the same row.
- **Colour and limb:** the Gaia DR3 BP/RP sampled spectrum (`source/photometry/gaia-dr3-xp-sampled.csv`) through the CIE 1931 2° observer, the route [HD 189733 A](../hd-189733/README.md) uses: sRGB (238, 237, 255). No transit or image measures the limb, so the sphere is darkened by the quadratic law Claret (2017, A&A 600, A30) computes from model atmospheres, interpolated to the star's Gaia temperature and gravity (u1 0.324, u2 0.223; `source/photometry/claret-2017-tess-quadratic.tsv`): a model, stated as one.
- **Rotation:** unmeasured. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).
- **The debris ring** is the attached volume [hd-181327-disc](../hd-181327-disc/README.md): six JWST/NIRCam coronagraph images of programme 2780 (Gáspár et al. 2026, [arXiv:2608.27437](https://arxiv.org/abs/2608.27437)) in the reflectance colour of the paper's Figure 1, placed in depth on a disc fitted to them.

Catalogue colour: the swatch that search, the catalogue and the minimap show is this lens's prepared colour, #eeedff.

## Evidence

- `tests/objects/unit/hd-181327/source.test.mts`: the manifest verifies; the astronomy record repeats the archived Gaia row; radius and GM are the FLAME values; the colour is (238, 237, 255); the limb law is the Claret (2017) grid at the archived Gaia temperature and gravity.
- `tests/objects/unit/hd-181327/default-view.test.mts`: the default camera looks at the Earth-facing hemisphere with the display axis up.
- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #eeedff is the colour lens's prepared colour.

## Known problems

- The photosphere is a uniform colour with a modelled limb: the star is 0.27 mas across and no image or limb measurement exists ([ledger](investigations.json)).
- The star's spin axis is not measured, so the sphere's axis is a display convention; the ring's own orientation is measured in the disc package.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
