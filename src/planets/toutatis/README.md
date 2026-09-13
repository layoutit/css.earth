# Toutatis

## Sources

**Shape** uses the Hudson, Ostro and Scheeres (2003) radar model archived in
[NASA PDS](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar.shape-models/data/4179toutatis2.xml)
as `urn:nasa:pds:compil.ast.radar.shape-models:data:4179toutatis2_tab::1.0`.
The 2020 PDS4 migration did not change the scientific data. The `.tab` is
Wavefront OBJ text, with its original label preserved beside the recipe.
The grid marks unavailable imagery. Shape remains the default dataset.

**Chang’e-2** adds the full-body photograph in
[Jiang et al. (2015), Figure 1c](https://pmc.ncbi.nlm.nih.gov/articles/PMC4629198/#f1),
taken during the 13 December 2012 flyby at a stated range of 67.7 km and original
sampling of 8.3 m/pixel. The source is a published, enlarged figure under
[CC BY 4.0](source/reference/CHANG-E-2-IMAGE-LICENSE.md). Its colors and lighting
are preserved. Placement on the radar shape is **approximate**, as stated in
the selector's summary and explanation. The grid covers excluded areas.

Both views use the same 800 retained triangles and default to Shadows off.
The [photographic method](source/reference/chang-e-2-method.md) records the
assumed camera, manual framing, source comparisons and transfer limits.
Accurate image-to-shape registration remains deferred.

[Inputs](source/manifest.json) · [Recipe](source/preparation/terrestrial.json) ·
[Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) ·
[Credits](NOTICE.md)

## Evidence

The source has 20,000 vertices and 39,996 facets, with kilometre units, centre
of mass at the origin and +Z along the long axis toward the small head. Bounds
are 2.281652 × 1.914287 × 4.581037 km; signed closed volume is 7.681121590 km³.
The reference radius is 1.224 km. Geometry is not rescaled to an incompatible
radius in the pinned Horizons record.

Meshoptimizer 1.2.0 retains source connectivity at 800 triangles using
`ErrorAbsolute`, `RegularizeLight` and a 50 m error setting. No radial geometry
replacement or opposite-face removal is used. The result is closed and
consistently wound, with 128 px native PolyCSS raster cells. The existing mesh
benchmark remains applicable because this addition does not change the source,
simplification or retained geometry: the library estimate is 27.55 m; 8,192
area-stratified samples per direction gave source-to-display mean 6.12 m,
p95 16.57 m, maximum 33.31 m, and display-to-source mean 6.10 m, p95 16.55 m,
maximum 40.50 m. These are sampled distances, not exhaustive bounds or source
measurement uncertainties.

The photographic report in [surfaces.json](prepared/surfaces.json) records
accepted pixels, sampled display-area coverage, source hashes, mask, projection
and transfer limits. Registration is explicitly `approximate`, `qualified: false`.
The reported coverage is coverage of this assumed projection. Neither the
50 m mesh-transfer limit nor its 0.01 m ray tolerance measures placement accuracy.
The [preparer tests](../../../tools/objects/surface-observations/published-image.test.mts)
exercise known planar correspondences, four-pixel rejection, occlusion, RGB
preservation and grid gaps. [Body tests](../../../tests/objects/unit/toutatis/)
check the original geometry, source pins and prepared package.

Validation on 13 September 2026 used the photographic recipe with SHA-256
`4e38f58d39e41df5deff1237bed6cd9ad01f3a1bfce46cf17d567992952a2480`
and its regenerated package. Preparation and preparation TypeScript checks
passed, as did 13 affected tests, three Toutatis source-closure checks, the
shared polygon-mask regression, package validation and focused test typing.
The image restored from its public URL into a fresh source directory. A fresh
runtime installation downloaded and verified all 34 files (7,904,888 bytes);
the three added image assets total 552,444 bytes.

Browser review exercised Shape/Chang’e-2 switching, preserved camera state,
rotation, close zoom, excluded-region grid, source credits and Shadows off.
Both datasets retained 800 triangles. Desktop 1405 × 1236 and mobile 390 × 844
were inspected at DPR 1. The running preview used shell base `ebd16155`, with
this package's prepared bytes installed and checked against the worktree.
No DPR 2 or full browser-suite result is claimed. The broader source suite
found Moon's stale factsheet record; aggregate test typing stopped on
`PerformanceEntry.detail` in the navigation timing test. Both affected files
were unchanged from base `d63ac090`; these failures are outside this addition.

## Known problems

The radar model uses 1992 and 1996 observations, with nominal average model
resolution around 34 m. Later radar and Chang’e-2 images reveal differences,
particularly around the large lobe and neck. The photo view is not a complete
spacecraft reconstruction or a map for measuring feature positions. Figure
resizing adds no camera detail. No calibrated reflectance or natural-color
reconstruction is claimed.

Toutatis tumbles, with characteristic rotation and precession periods near
5.4 and 7.4 days. Its existing `cssearth-display-orientation@1` recipe uses a
fixed arbitrary orientation and zero propagated spin. Optional directional
lighting is illustrative, including when applied to an already lit photograph;
it does not recreate an observation or present-day attitude. See the
[rotation analysis](https://arxiv.org/abs/1511.04357).

<a id="toutatis-source-and-presentation"></a>
<a id="dataset-survey"></a>

<details>
<summary>Other source routes</summary>

- The older low-resolution radar model and NASA STL add no necessary dataset
  beside the better documented PDS model.
- A radial elevation trial found multiple source intersections in 7 of 8,192
  sampled directions through the neck. A single radial scalar cannot truthfully
  color those distinct patches, so Elevation remains excluded.
- [Huang et al. (2013)](https://doi.org/10.1038/srep03411) has CC BY-NC-ND terms;
  its image is not used for a modified texture. Jiang's later figure has different,
  reusable terms.
- [Optical/radar fusion](https://doi.org/10.1016/j.pss.2016.03.008) may provide a
  better matching shape, but a released mesh with independent controls was not
  retrieved. That is an unresolved source route, not evidence that none exists.
- [Stooke's 1996 outline map](https://www.lpi.usra.edu/meetings/lpsc1996/pdf/1642.pdf)
  uses an older arbitrary mapping frame and is not a registered photographic map.

Shared sky and font inputs retain their original licenses and pins.

</details>
