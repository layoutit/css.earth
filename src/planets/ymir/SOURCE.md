# Ymir source survey

The Shape model dataset is an **approximate triangular body constrained by published model dimensions**. It is not the original convex inversion mesh, a contact-binary reconstruction or a photographic surface map.

## Shape and scale

[Denk and Mottola (2013), EP7.2](https://www.dpg-verhandlungen.de/2013/jena/ep7.pdf) describes the Cassini lightcurve model as roughly a triangular prism, with equatorial edges approximately **20, 24 and 25 km** and a full polar axis approximately 15 km. The [author's numeric physical table](https://tilmanndenk.de/wp-content/uploads/619_Ymi_1_Table.txt) gives the same equatorial edges and a rounded polar semiaxis of **8 km**. Its reference-ellipsoid semiaxes of 12 × 11 × 8 km summarize the model; an ellipsoid alone would omit the known triangular outline. [Denk et al. (2018), sections 3.2–3.3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) confirms this interpretation and explains the limits of convex lightcurve inversion.

The authored polygon has vertices `(0,0)`, `(25,0)` and `(16.02, sqrt(24²−16.02²))` km before subtracting its area centroid. Its edges are exactly 25, 20 and 24 km for reproducibility, while those source dimensions remain approximate. At height `z`, its cross-section scales by `sqrt(1−(z/8)²)`. This elliptical polar-cap law is assumed; it does not recover unseen surface details or reproduce the original inversion solution.

The geometry preserves those absolute dimensions. Its analytic volume is approximately **2,382.75 km³**, equivalent to a radius of **8.2857 km**. The separate **9.6 km nominal photometric radius** depends on assumed reflectivity; the source's diameter estimate is approximately 19 km with −3/+5 km uncertainty. That is not a measured volume constraint. The shape is not silently rescaled to 9.6 km while retaining the quoted edge lengths. Exact recipe values are in `source/measurements.json`.

## Dataset candidates

- **Cassini ISS imagery and lightcurves:** [PDS archive](https://pds-rings.seti.org/cassini/iss/) and the [author's observation record](https://tilmanndenk.de/outersaturnianmoons/ymir/) provide disk-integrated measurements, not qualified mapped texels. The released [multi-observation lightcurve table](https://tilmanndenk.de/wp-content/uploads/619_Ymi_4_LC_Paper1.txt) and [2008 lightcurve](https://tilmanndenk.de/wp-content/uploads/619_ymi_4_lc064.txt) are useful future chart candidates; no lightcurve chart is implemented here.
- **Original convex mesh:** the author's actual linked `619_Ymi_5_Shape.obj` endpoint returned HTTP 404 during this survey, consistent with its unavailable status on the page. The native mesh remains an unresolved replacement candidate. The authored geometry is not presented as a download of that mesh.
- **Color and spectroscopy:** published disk-integrated color observations do not establish a spatial color map. The author notes possible UVIS/VIMS observations but no qualified extracted spectrum; instrument observations alone do not justify a spectral lens. No spectrum is implemented.
- **Elevation/geology:** no registered DEM or mapped geology product was qualified. Neither the lightcurve facets nor a speculative contact-binary interpretation supply terrain, craters or a neck to render.

## Orientation and presentation

The measured sidereal period is **11.92220 ± 0.00002 hours**. The author's ecliptic pole `(230°, −85°)`, with approximate uncertainties `(20°, 10°)`, converts using J2000 obliquity to equatorial `(99.4936°, −70.1439°)`, consistent with the original paper's rounded pole. Rotation about this southward pole gives the reported retrograde sense. The pole solution does not establish a current landmark phase; the initial meridian is arbitrary.

The author's mass and density estimates are explicitly speculative and are not treated as measured facts. A zero GM field means unmodeled mass. The shared missing-data grid covers the entire shape, with Flood lighting by default and directional Shadows available. No observed terrain or albedo pattern is implied. Thumbnail, minimap and context billboard use the same approximation. Source pins and preparation inputs belong in the existing manifest and acquisition records.

## Orbital preview

The shared astronomy package uses a Horizons-fitted precessing ellipse plus bounded periodic ICRF residuals, valid for 2020–2032. The maximum position difference at six independent fixture epochs is 161,335 km; across 37 additional epochs it is 231,069 km, with a maximum angular difference of 0.4930°. These sampled comparisons do not guarantee accuracy between samples or outside the fit window. The scene is an approximate orbital preview, not precision tracking. See the astronomy package README for the fit sources and method.
