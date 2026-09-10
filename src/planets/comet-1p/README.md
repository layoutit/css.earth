# 1P/Halley

## Sources

- The selected [PDS4 Stooke Halley product](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/1682q1halley.xml) contains 2,701 longitude/latitude/radius rows at 5° intervals, including repeated 0°/360° seam samples and poles.

- Model author Philip Stooke used Giotto/Vega limb and terminator fits with pointing by Alain Abergel.

- [Stooke & Abergel (1991), A&A 248, 656–668](https://articles.adsabs.harvard.edu/pdf/1991A%26A...248..656S) publishes a separate 10° radius table (Table 2) and encounter viewing geometry (Table 1). Its rotation-axis frame differs from the long-axis frame of the selected PDS product; these inputs must not be mixed.

- Stooke's [Small Body Mapping Results — 1994 (LPSC 1995)](https://www.lpi.usra.edu/meetings/lpsc1995/pdf/1683.pdf) reports a revised Halley shape using Belton et al.'s slow long-axis rotation model. It describes agreement with the complete image set, conditional on uncertain limb identification. The two-page abstract does not provide numerical camera controls or a radius table. The Giotto view instead reconstructs approximate encounter geometry from the public rotation compilation and mission ephemerides below. The selected PDS product also cites Belton's rotation model, but that shared citation alone does not establish an exact model/version match.

- The [MPS Halley Multicolour Camera page](https://www2.mps.mpg.de/de/projekte/giotto/hmc/) supplies a 68-image Giotto composite and a nucleus outline. It permits educational image use with MPS attribution; commercial reuse requires permission. This statement applies to those displayed images, not automatically to the entire calibrated archive.

- [Samarasinha, Mueller, Belton & Jorda (2004), archived rotation compilation](https://pdssbn.astro.umd.edu/holdings/ear-c-compil-5-comet-nuc-rotation-v1.0/dataset.shtml), supplies the long-axis state and periods used for the approximate projection. [NASA SPDF Vega ephemerides](https://spdf.gsfc.nasa.gov/pub/data/vega/mag/) and original PDS FITS headers supply the spacecraft geometry. Exact inputs are pinned in the [registration](source/reference/giotto-registration.json).

## Evidence

- The [projection report](source/reference/giotto-projection-report.json) records 4,842 observed pixels in a 512 × 256 map and about **4.3% sampled source surface coverage**. The rest is grid. This is the accepted footprint of this projection, not a census of all Halley photography.
- Camera orientation is derived before fitting image scale and centre. Of 64 manually transcribed catalogue outline points, 42 fit those three image-plane parameters and 22 are held out. Held-out distance to the projected full-mesh silhouette is **0.211 km RMS, 0.456 km maximum**, within the source's stated 0.5–1 km absolute shape uncertainty. This checks silhouette consistency; it does not independently establish individual feature coordinates.
- The source projection tests reproduce the checked-in PNG and validity bytes, preserve valid dark pixels, and check the concave footprint boundary. Object preparation retains the same 1,000-face shape.

- The [pinned candidate manifest](source/reference/giotto-hmc-intake.json) and [intake report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/HALLEY-GIOTTO.md) retain a reproducible seven-frame survey from the original PDS SBN release, including its separate FITS geometry headers.

- Qualification is recorded in [HALLEY.md](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/HALLEY.md).

## Known problems

- This is a highly uncertain historical inverse shape model. The label estimates absolute uncertainty of about 500–1,000 m, relative point-to-point uncertainty around 100 m, and warns that facets and depressions may be exaggerated.

- **Historical model** is a neutral shape view. **Giotto** projects a small illuminated region of the MPS composite onto that shape. Neither view is a measured albedo map; the Giotto image retains its original illumination and dust contamination.

- The original local frame is preserved while its attitude in space is explicitly illustrative: the long axis is placed along ICRF +Z (display RA 0°, Dec +90°, meridian 0°) and held fixed. Lighting shows that chosen orientation, not an encounter or current attitude.

- Giotto registration is approximate: published rotation parameters are rounded, the Vega observer position is extrapolated for 148 seconds, and a multi-exposure composite is represented by one incoming-frame camera. Unmapped, uncertain, grazing and occluded regions remain grid. Isolated bright patches and jets are excluded.

- The 1991 paper's own §5 reports that its model does not reproduce the Giotto terminator or part of the dark limb. Fitting a photographic outline alone therefore cannot establish feature locations. The paper discusses changing the viewing geometry by about 40°, but explicitly does not supply that revised model. Its Table 1 camera cannot be reassigned to the later PDS mesh without a documented frame relationship.

- The 1991 mismatch does not reject the revised model reported in 1995. The present projection uses the later long-axis state, with the limitations above. [Reitsema, Delamere & Keller (1989)](https://doi.org/10.1016/0273-1177(89)90244-5) supplies a separate catalog of 21 bright features and eight morphological regions that may support independent registration checks; its reference frame must first be matched to the chosen model.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="halley-source-and-interpretation"></a>

The exact table, XML label and bundle description are checked in and pinned in `source/manifest.json`.

It even considers the convex hull comparably plausible. cssEarth retains the published shape; it does not choose a new hull or imply that its apparent fine detail is resolved terrain. Source precision is not source accuracy.

## Coordinates and geometry

The specific PDS4 label gives east-positive longitude and kilometres, superseding the west-positive convention of the old PDS3 v1 release. The reference axis is the **long axis**, with north towards the larger end. It is not a simple spin pole. The source longitude phase refers to the first high-resolution Vega 2 image (image identifier 2:00:30, sub-spacecraft longitude 270°; this is not 02:00:30 UTC). The original model origin is preserved; the bundle warns that origins need not coincide with centres of figure.

Preparation converts rows to right-handed XYZ metres: x = r cos(lat) cos(lon), y = r cos(lat) sin(lon), z = r sin(lat). The regular grid defines connectivity, giving 2,522 unique vertices and 5,040 triangles after pole and seam welding. The longitude-zero sample is the canonical seam/pole sample. Repeated rows differ by at most 0.000001 km (1 mm) from those canonical values; the loader accepts that existing precision allowance plus binary roundoff and rejects larger disagreements. No radii are filled or recentered.

The source mesh encloses 402,178,495,186.9002 cubic metres. Its equivalent-volume radius, cbrt(3 V / (4 pi)), is 4.57906433330178 km and supplies display scale only; it is not a precise measured mean radius. Its XYZ extents are approximately 7.53 × 7.58 × 15.14 km. No mass or GM is claimed; the astronomy registry follows its existing zero-for-unknown convention.

Meshoptimizer 1.2.0 retains source positions and reduces the grid mesh to 1,000 triangles with a 100 m simplification allowance. Its estimated error is 59.14 m; that is not a Hausdorff bound or observational uncertainty. The reduced mesh is one closed outward component with Euler characteristic two and about 0.32% less volume. Source-mesh normals and directional/flood lighting are baked into fixed native triangle atlases. Runtime derives no geometry or lighting assets.

The existing per-object camera `framingScale` is 0.7 so the elongated nucleus fits on arrival. This changes viewport framing only; the source origin, physical scale, geometry, atlas bytes and targeting triangles are unchanged.

## Material, orientation and placement

The **Historical model** view uses uniform #b8b6b2 material. The **Giotto** view uses photographic pixels only inside the accepted footprint and the existing gray grid elsewhere. Shadows defaults to **off** for both datasets. Navigation context is rendered from the same simplified geometry and material.

These are presentation choices, not Halley's physical spin solution. No rotation-period fact or spin/tumble animation is supplied.

Heliocentric placement uses JPL Horizons `DES=1P;CAP;`, centre `500@10`, ICRF, at JD 2461286.5 (3 September 2026). Raw elements and independent geometric vector responses are pinned under `source/reference/`; the generated astronomy fixtures also preserve exact queries. TDB is approximated as TT within 2 ms. The osculating conic omits perturbations and outgassing and is checked against independent vectors at the prepared epoch and ±30 days, not claimed as a long-term ephemeris.

## Focused source survey

| Candidate | Disposition |
| --- | --- |
| PDS Stooke shape table and specific PDS4 label above | Included: complete radius grid and documented uncertainty/frame. |
| [PDS bundle description](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/document/bundle_description.txt) | Included: coordinate-convention migration, origin and shape caveats. |
| [ESA calibrated Giotto HMC archive](https://esdcdoi.esac.esa.int/doi/html/data/planetary/GIOTTO/GIO-C-HMC-3-RDR-HALLEY.html), DOI 10.5270/esa-s11mti2 | Real calibrated encounter images; excluded from this model lens. Registration, coma contamination, missing coverage and photometry have not been qualified for a mapped surface. A calibrated frame is not a global texture. |
| [PDS comet target index](https://pdssbn.astro.umd.edu/data_sb/target_comets.shtml), Vega 1/2 and IHW near-nucleus releases | Complementary encounter observations; unresolved as a registered texture product, with no additional lens promised. |
| [Belton et al. (1991)](https://doi.org/10.1016/0019-1035(91)90207-A), referenced by the source label | Historical rotation assumptions inform the shape source. No current attitude propagation is implemented. |

This package contains the nucleus model only; no coma, tail or outgassing scene.

## Giotto projection

The [source-specific preparer](../../../tools/objects/comet-1p/prepare-giotto.mjs) reads the pinned MPS display composite, not the separately surveyed calibrated PDS image pixels. Run it with `node tools/objects/comet-1p/prepare-giotto.mjs --write`, then run the normal authored Halley preparation. The registration JSON is an authored input; its image-plane scale, centre and footprint are retained with their controls and provenance.

The 2004 table gives angular momentum RA 7°, Dec −60°, a long-axis direction RA 314°, Dec −7° at JD 2446498.806, precession period 3.69 days and roll period 7.1 days. Stooke's Vega image anchor fixes longitude 270°. Table 1 in the 1991 paper places that image 1.5 seconds before closest approach. The TVS header places closest approach at 07:19:59.5 UTC, giving an anchor of 07:19:58 UTC on 9 March 1986.

The last two one-minute SPDF Vega positions are linearly extrapolated for 148 seconds. The daily heliocentric trajectory fixes the Sun direction for the comet-solar-ecliptic frame. Obliquity 23.4411° transforms it to equatorial coordinates; the omitted date-to-J2000 precession is below 0.2° and belongs to the camera's approximation. At the anchor, +Z follows the long axis and −Y follows the observer projection perpendicular to it. Propagating this frame with the two published periods places Giotto at approximately **161.41° E, 18.53° N** in the shape frame at C3436 (13 March 1986, 23:58:07.117440 UTC).

The original HMC header provides the comet, spacecraft and Sun position vectors in B1950. The pinned approximate B1950-to-J2000 rotation supplies the observer and Sun directions. The MPS caption fixes image-plane Sun orientation, giving a predicted long-axis image angle of 63.97°, compared with about 62.8° on the catalogue outline. The catalogue's yellow historical spin-axis marking is not used.

An independent image-to-image similarity transform registers catalogue figure 67 to `hmc_best.gif`: scale 0.35763, rotation 0.7724°, translation (386.03, 484.00) pixels. Grayscale samples exclude colored annotations and white contours; held-out intensity correlation is 0.9909. Full-mesh silhouette validation then fits image scale and centre only. Neither the body camera nor mesh vertices are fitted to the outline.

Coverage follows an authored polygon inside figure 67's illuminated region, inset by 25 catalogue pixels (about 0.5 km). Preparation rejects emission angles over 75°, incidence angles over 80° and full-source-mesh occlusion. Area-weighted source normals are interpolated for these angular cuts. The mask is geometric, never a brightness threshold. Bilinear RGB sampling retains the source display levels; exact RGB zero is reserved for gaps, so valid black becomes RGB (1,1,1). No contrast gain, albedo correction, mirrored imagery or synthetic detail is added.

Seven barycentric samples per source triangle estimate about 4.3% coverage. Reducing the inset to zero would raise this same polygon's estimate to about 8.2%, but would include the least certain boundary. This sensitivity is an opportunity for better control, not evidence that the larger area is already registered. Additional Giotto and Vega observations remain candidates; this dataset does not exhaust them.

The old [calibrated-image intake](source/reference/giotto-hmc-intake.json) remains a separate historical survey. Its unqualified status and image reuse questions apply to those raw frames, not to the displayed MPS composite used here.

See [NOTICE.md](NOTICE.md) for credits.

</details>
