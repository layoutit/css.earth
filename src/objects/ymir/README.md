# Ymir

## Sources

- [Denk and Mottola (2013), EP7.2](https://www.dpg-verhandlungen.de/2013/jena/ep7.pdf) describes the Cassini lightcurve model as roughly a triangular prism, with equatorial edges approximately **20, 24 and 25 km** and a full polar axis approximately 15 km. The [author's numeric physical table](https://tilmanndenk.de/wp-content/uploads/619_Ymi_1_Table.txt) gives the same equatorial edges and a rounded polar semiaxis of **8 km**.

- The separate **9.6 km nominal photometric radius** depends on assumed reflectivity; the source's diameter estimate is approximately 19 km with −3/+5 km uncertainty.

- **Color:** [Grav and Bauer (2007), Table 2](https://doi.org/10.1016/j.icarus.2007.04.020) measured the whole disc at B−V = 0.789 ± 0.024, V−R = 0.438 ± 0.018 and V−I = 0.884 ± 0.018, as the weighted mean of 2 nights: 2005-01-06 (Keck I LRIS, Johnson-Kron-Cousins BVRI filters); 2005-04-13 (Gemini North GMOS, SDSS g'r'i'z' filters converted to BVRI by the authors). [The record](source/photometry/disc-color.json) turns them into one sRGB color, #484541, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness (an estimate):** nobody has measured Ymir's albedo. The color is scaled to 6%, the value [Denk et al. (2018)](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) assume for its size. The two small irregular moons of Saturn with a measured albedo are Albiorix at 6.2 ± 2.8% and Siarnaq at 5.0 ± 1.7%; eleven irregular moons of Jupiter range from 2.9% to 5.7% ([Grav et al. (2015), Table 3](https://doi.org/10.1088/0004-637X/809/1/3)).

## Evidence

- **Original convex mesh:** the author's actual linked `619_Ymi_5_Shape.obj` endpoint returned HTTP 404 during this survey, consistent with its unavailable status on the page.

- The shared astronomy package uses a Horizons-fitted precessing ellipse plus bounded periodic ICRF residuals, valid for 2020–2032. The maximum position difference at six independent fixture epochs is 161,335 km; across 37 additional epochs it is 231,069 km, with a maximum angular difference of 0.4930°. These sampled comparisons do not guarantee accuracy between samples or outside the fit window.

## Known problems

- The Shape model dataset is an **approximate triangular body constrained by published model dimensions**. It is not the original convex inversion mesh, a contact-binary reconstruction or a photographic surface map.

- This elliptical polar-cap law is assumed; it does not recover unseen surface details or reproduce the original inversion solution.

- The author's mass and density estimates are explicitly speculative and are not treated as measured facts. One whole-disc color covers the entire shape, with Flood lighting by default and directional Shadows available.

- The pole solution does not establish a current landmark phase; the initial meridian is arbitrary.

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Its brightness is an estimate and would change with a measured albedo.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="ymir-source-survey"></a>

## Shape and scale

Its reference-ellipsoid semiaxes of 12 × 11 × 8 km summarize the model; an ellipsoid alone would omit the known triangular outline. [Denk et al. (2018), sections 3.2–3.3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) confirms this interpretation and explains the limits of convex lightcurve inversion.

The authored polygon has vertices `(0,0)`, `(25,0)` and `(16.02, sqrt(24²−16.02²))` km before subtracting its area centroid. Its edges are exactly 25, 20 and 24 km for reproducibility, while those source dimensions remain approximate. At height `z`, its cross-section scales by `sqrt(1−(z/8)²)`.

The geometry preserves those absolute dimensions. Its analytic volume is approximately **2,382.75 km³**, equivalent to a radius of **8.2857 km**. That is not a measured volume constraint. The shape is not silently rescaled to 9.6 km while retaining the quoted edge lengths. Exact recipe values are in `source/measurements.json`.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation and presentation

The measured sidereal period is **11.92220 ± 0.00002 hours**. The author's ecliptic pole `(230°, −85°)`, with approximate uncertainties `(20°, 10°)`, converts using J2000 obliquity to equatorial `(99.4936°, −70.1439°)`, consistent with the original paper's rounded pole. Rotation about this southward pole gives the reported retrograde sense.

A zero GM field means unmodeled mass. No observed terrain or albedo pattern is implied. Thumbnail, minimap and context billboard use the same approximation. Source pins and preparation inputs belong in the existing manifest and acquisition records.

## Orbital preview

The scene is an approximate orbital preview, not precision tracking. See the astronomy package README for the fit sources and method.

</details>
