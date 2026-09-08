# Further comet intake

The PoC includes 67P, Hartley 2 and Tempel 1. Additional names are not registered until their geometry and interpretation support a useful mounted scene. The following archive products were inspected on 8 September 2026; an unresolved candidate is not a claim that usable data does not exist.

## Wild 2: observed hemisphere remains a candidate

[PDS v2.1](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/dataset.shtml) provides two materially different products. The [full model label](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/data/wild2_plan_full.lbl) distinguishes observed vertices, an assumed ellipsoid for unseen terrain, and connecting plates without physical meaning. That completion is excluded from this PoC.

The [observed-only Cartesian model](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/data/wild2_cart_vis.lbl) contains 6,432 vertices and 12,514 plates in meters. Its +Z direction is RA 112°, declination −17°; +X follows the long dimension. The [catalogue](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/catalog/dataset.cat) describes approximately half-surface coverage, about 50 m horizontal resolution and 6 m vertical precision.

A local preparation trial found six inconsistent shared-edge directions in the original plate ordering. Reorienting two faces without moving any vertices allows a 996-face reduction with a 49.46 m simplifier error estimate, no inconsistent edge winding, and all 348 original boundary edges preserved. This trial is **not qualified for the app**: the observed surface contains separate patches, and views from the unobserved side expose the open boundary. Those gaps must remain explicit; a closed nucleus cannot be supplied by filling them. The [intake receipt and topology summary](evidence/wild2-intake.json) bind the source hashes and trial results. The original model, labels and full topology trial are retained under `output/comet-intake/wild2/`. Open-surface targeting, visual interpretation and browser behavior remain to be qualified. No Wild 2 route, geometry or fallback is shipped.

## Borrelly: image-frame terrain, not a closed nucleus

The [DS1 PDS catalogue](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/catalog/dataset.cat) provides USGS and DLR stereo elevation models for the visible, illuminated side. Their coordinates are a local image-related frame; heights are relative to a reference plane. The [USGS label](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/data/usgsdem.lbl) specifies a 16 m grid with missing positions omitted and includes surface normals. The catalogue reports roughly 85 m mean differences between the two independently processed models.

A useful implementation would preserve that terrain footprint, datum and observed framing. Treating these heights as global nucleus radii would be incorrect. This partial terrain presentation remains unresolved and is not registered.

## Halley: highly uncertain historical shape

The [specific PDS4 Halley label](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/1682q1halley.xml) describes Stooke's Giotto/Vega limb-and-terminator model: 2,701 longitude/latitude/radius samples, 5° spacing, kilometers, east-positive longitude. The coordinate reference axis follows the long axis, with north toward the larger end; it must not be substituted for a simple spin pole.

The source estimates absolute errors around 500–1,000 m and warns that depressions may be exaggerated. Its [bundle description](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/document/bundle_description.txt) also warns that the model origin need not be the center of figure. A historical model view could be useful with these limits, but a detailed surface or confidently registered current orientation is not supported by this intake. The exact table, label and hashes are retained under `output/comet-intake/halley/`; no Halley scene is shipped.
