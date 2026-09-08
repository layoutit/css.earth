# Halley: source and interpretation

The selected [PDS4 Stooke Halley product](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/1682q1halley.xml)
contains 2,701 longitude/latitude/radius rows at 5° intervals, including repeated
0°/360° seam samples and poles. The exact table, XML label and bundle description
are checked in and pinned in `source/manifest.json`. Model author Philip Stooke
used Giotto/Vega limb and terminator fits with pointing by Alain Abergel.

This is a highly uncertain historical inverse shape model. The label estimates
absolute uncertainty of about 500–1,000 m, relative point-to-point uncertainty
around 100 m, and warns that facets and depressions may be exaggerated. It even
considers the convex hull comparably plausible. cssEarth retains the published
shape; it does not choose a new hull or imply that its apparent fine detail is
resolved terrain. Source precision is not source accuracy.

## Coordinates and geometry

The specific PDS4 label gives east-positive longitude and kilometres, superseding
the west-positive convention of the old PDS3 v1 release. The reference axis is
the **long axis**, with north towards the larger end. It is not a simple spin
pole. The source longitude phase refers to the first high-resolution Vega 2
image (02:00:30, sub-spacecraft longitude 270°). The original model origin is
preserved; the bundle warns that origins need not coincide with centres of figure.

Preparation converts rows to right-handed XYZ metres: x = r cos(lat) cos(lon),
y = r cos(lat) sin(lon), z = r sin(lat). The regular grid defines connectivity,
giving 2,522 unique vertices and 5,040 triangles after pole and seam welding.
The longitude-zero sample is the canonical seam/pole sample. Repeated rows differ
by at most 0.000001 km (1 mm) from those canonical values; the loader accepts
that existing precision allowance plus binary roundoff and rejects larger
disagreements. No radii are filled or recentered.

The source mesh encloses 402,178,495,186.9002 cubic metres. Its equivalent-volume
radius, cbrt(3 V / (4 pi)), is 4.57906433330178 km and supplies display scale only;
it is not a precise measured mean radius. Its XYZ extents are approximately
7.53 × 7.58 × 15.14 km. No mass or GM is claimed; the astronomy registry follows
its existing zero-for-unknown convention.

Meshoptimizer 1.2.0 retains source positions and reduces the grid mesh to 1,000
triangles with a 100 m simplification allowance. Its estimated error is 59.14 m;
that is not a Hausdorff bound or observational uncertainty. The reduced mesh is
one closed outward component with Euler characteristic two and about 0.32% less
volume. Source-mesh normals and directional/flood lighting are baked into fixed
native triangle atlases. Runtime derives no geometry or lighting assets.

## Material, orientation and placement

The single **Historical model** view uses uniform #b8b6b2 material with shared
Shadows and flood-light controls. It is neither a photograph nor an albedo map.
The table has only longitude, latitude and radius: no source-supported regional
confidence flags exist in this product, so no selective grid boundary is drawn.
Navigation context is rendered from the same simplified geometry and material.

The original local frame is preserved while its attitude in space is explicitly
illustrative: the long axis is placed along ICRF +Z (display RA 0°, Dec +90°,
meridian 0°) and held fixed. These are presentation choices, not Halley's physical
spin solution. No rotation-period fact or spin/tumble animation is supplied.
Lighting shows that chosen orientation, not an encounter or current attitude.

Heliocentric placement uses JPL Horizons `DES=1P;CAP;`, centre `500@10`, ICRF,
at JD 2461286.5 (3 September 2026). Raw elements and independent geometric vector
responses are pinned under `source/reference/`; the generated astronomy fixtures
also preserve exact queries. TDB is approximated as TT within 2 ms. The osculating
conic omits perturbations and outgassing and is checked against independent
vectors at the prepared epoch and ±30 days, not claimed as a long-term ephemeris.

## Focused source survey

| Candidate | Disposition |
| --- | --- |
| PDS Stooke shape table and specific PDS4 label above | Included: complete radius grid and documented uncertainty/frame. |
| [PDS bundle description](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/document/bundle_description.txt) | Included: coordinate-convention migration, origin and shape caveats. |
| [ESA calibrated Giotto HMC archive](https://esdcdoi.esac.esa.int/doi/html/data/planetary/GIOTTO/GIO-C-HMC-3-RDR-HALLEY.html), DOI 10.5270/esa-s11mti2 | Real calibrated encounter images; excluded from this model lens. Registration, coma contamination, missing coverage and photometry have not been qualified for a mapped surface. A calibrated frame is not a global texture. |
| [PDS comet target index](https://pdssbn.astro.umd.edu/data_sb/target_comets.shtml), Vega 1/2 and IHW near-nucleus releases | Complementary encounter observations; unresolved as a registered texture product, with no additional lens promised. |
| [Belton et al. (1991)](https://doi.org/10.1016/0019-1035(91)90207-A), referenced by the source label | Historical rotation assumptions inform the shape source. No current attitude propagation is implemented. |

This package contains the nucleus model only; no coma, tail or outgassing scene.
