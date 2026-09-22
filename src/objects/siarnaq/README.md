# Siarnaq

## Sources

- [Denk et al. (2018), section 3.2 and Figure 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) infer a triangular body from Cassini lightcurves.

- The recipe uses the [author's rendered model figure](https://tilmanndenk.de/wp-content/uploads/629_Sia_0_Title2.png), not its photographed brightness as terrain.

- The whole approximation is volume-normalized to radius 19.5 km, using the approximately **39 ± 6 km thermal diameter** summarized in the [author's physical table](https://tilmanndenk.de/outersaturnianmoons/siarnaq/).

## Evidence

- **Original convex mesh:** no native OBJ was linked on the reviewed page; checking the analogous author-file URL also returned HTTP 404.

- The shared astronomy package uses a Horizons-fitted precessing ellipse plus bounded periodic ICRF residuals, valid for 2020–2032. The maximum position difference at six independent fixture epochs is 280,356 km; across 37 additional epochs it is 321,402 km, with a maximum angular difference of 1.6074°. These sampled comparisons do not guarantee accuracy between samples or outside the fit window.

## Known problems

- The Shape model dataset is a **coarse approximation of a published convex model's envelope**. It is not the original inversion mesh, a resolved photograph or a surface map.

- Equating that effective diameter with a volume diameter is a display convention, not a measured volume or three measured axes. This construction does not reproduce the exact inversion model or its lightcurves.

- No registered photographic surface product was qualified, so they do not become a texture lens. The ordinary shared missing-data grid covers the entire shape.

- This constrains the approximate spin axis, not a current prime-meridian or landmark phase; the initial meridian is arbitrary.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="siarnaq-source-survey"></a>

## Shape and scale

The caption identifies an equatorial view with north up and a north-pole view. Convex lightcurve inversion cannot recover craters, concavities or a unique detailed surface.

A threshold of 8 separates the right silhouette from the black background; its convex boundary is simplified within 3 figure pixels and centered on its area centroid. That projected envelope becomes the approximate equatorial polygon. The two views both span 465 pixels horizontally, supporting an approximately common orthographic scale. The left view's 344-pixel height supplies an adopted polar semiaxis of 172 pixels. Projection and depth remain approximate; the polar silhouette is not an independently measured equatorial cross-section.

At height `z`, the polygon is scaled by `sqrt(1−(z/c)²)`. These symmetric elliptical caps are an explicit assumption. The resulting dimensions and figure coordinates are recorded in `source/measurements.json`.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation and presentation

The published sidereal period is **10.18785 hours**, with approximately 0.2-second uncertainty. The ecliptic pole `(98°, −23°)`, uncertain by approximately 15°, is converted using J2000 obliquity to equatorial coordinates. A zero GM field means unmodeled mass, not measured physical zero.

Shared Flood lighting remains the default and directional Shadows remains available. No albedo pattern, terrain, atmosphere or rings are synthesized. Thumbnail, minimap and context billboard derive from the same approximation. Geometry simplification error is separate from scientific uncertainty. Source pins and preparation inputs belong in the existing manifest and acquisition records.

## Orbital preview

The scene is an approximate orbital preview, not precision tracking. See the astronomy package README for the fit sources and method.

</details>
