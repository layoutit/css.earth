# Toutatis

## Sources

The Shape view uses the original high-resolution Hudson, Ostro and Scheeres (2003) radar model archived in NASA PDS as `urn:nasa:pds:compil.ast.radar.shape-models:data:4179toutatis2_tab::1.0`. The PDS4 migration in 2020 did not change the scientific data. Input `source/shape/4179toutatis2.tab` is Wavefront OBJ text despite its extension; its unchanged label is kept beside the recipe under `source/reference/`. The acquisition plan restores the exact pinned bytes from [PDS](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar.shape-models/data/4179toutatis2.tab).

Shape uses the shared no-imagery grid with Shadows disabled by default. Optional prepared directional lighting conveys the source geometry, with no photographic texture, albedo claim, invented craters or compositional colors. The map, thumbnail and navigation context derive from the same mesh and grid.

## Evidence

Meshoptimizer 1.2.0 simplifies the original connectivity to 800 triangles before texture preparation, with `ErrorAbsolute` and `RegularizeLight`, a 50 m error setting, no radial geometry replacement, and no removed opposite faces. The result is closed and consistently wound. The library estimate is 27.55 m, distinct from a geometric bound. Two-way area-stratified surface samples (8,192 per direction) give source-to-display mean 6.12 m, p95 16.57 m, maximum 33.31 m, and display-to-source mean 6.10 m, p95 16.55 m, maximum 40.50 m. These are sampled nearest-triangle distances, not exhaustive Hausdorff bounds or source measurement uncertainties. Native PolyCSS `u` triangles use 128 px raster cells and the established prepared lighting path.

[Source test definitions](../../../tests/objects/unit/toutatis/source.test.mjs).

## Known problems

The source is based on radar observations in 1992 and 1996, with nominal average model resolution around 34 m. Later radar and Chang’e-2 images show mismatches, particularly at the large lobe; it must not be described as a complete spacecraft reconstruction. The [2013 rotation study](https://echo.jpl.nasa.gov/asteroids/takahashi.etal.toutatis.2013.pdf) discusses the residual shape differences. Details below the display mesh’s spacing are not retained.

Toutatis has non-principal-axis tumbling, with characteristic rotation and precession periods around 5.4 and 7.4 days. The existing `cssearth-display-orientation@1` recipe deliberately uses a fixed arbitrary frame, zero propagated spin and illustrative lighting. It does not apply a linear rotation period or claim a present-day attitude. The [2015 rotational analysis](https://arxiv.org/html/1511.04357) gives a measured flyby attitude and dynamics; no current attitude propagation is derived from it here.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="toutatis-source-and-presentation"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

The archive specifies kilometers, center of mass as origin, and principal axes. For Toutatis, +Z is the long axis, not a spin pole. Longitude is eastward around that source axis and latitude is planetocentric; they describe the model frame. The 20,000 vertices and 39,996 facets span 2.281652 × 1.914287 × 4.581037 km. Signed closed volume is 7.681121590 km³, giving a volume-equivalent radius of 1.223992275 km; the common reference radius is rounded to 1.224 km. The mesh is not rescaled to the incompatible radius field in the pinned Horizons physical record.

**Dataset survey**

- **Included: PDS high-resolution radar shape.** [Release](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar.shape-models/) supplies exact model connectivity, scale and coordinate documentation. Its [JPL OBJ counterpart](https://echo.jpl.nasa.gov/asteroids/shapes/hirestoutatis.obj) adds no separate view.
- **Excluded: older low-resolution radar model and NASA STL.** [JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) and [NASA 3D resource](https://science.nasa.gov/3d-resources/asteroid-4179-toutatis/) were reviewed. The scientific high-resolution release has clearer metadata and sufficient detail before budget reduction.
- **Excluded from current view: radial Elevation.** A trial found multiple surface intersections in 7 of 8,192 sampled directions through the concave neck. One direction intersects the source at 1,285.61, 1,363.00 and 1,734.56 m. The current shared radial scalar would assign one ray height to distinct surface patches, so it cannot truthfully color this full connected mesh. Geometry itself retains the neck. A future mesh-attached scalar preparation is needed.
- **Unresolved: Chang’e-2 photographic coverage and later fused geometry.** [Flyby observations](https://arxiv.org/abs/1511.02131), [boulder study](https://pmc.ncbi.nlm.nih.gov/articles/PMC4629198/) and the 2016 paper *Radar model fusion of asteroid (4179) Toutatis via its optical images observed by Chang’e-2 probe*, Planetary and Space Science 125, 87–95, describe richer information. The flyby observed roughly 45% of the surface. A restorable released texture/mesh with full calibration and source-frame registration was not qualified in this survey; literature figures are not a global surface map. This is an unresolved release route, not evidence that the data do not exist.
- **Excluded: preliminary geological outline map.** [Stooke 1996](https://www.lpi.usra.edu/meetings/lpsc1996/pdf/1642.pdf) has tentative features in an older arbitrary mapping frame and discusses radar image reversals. It does not provide a registered calibrated raster for this mesh. The related CE2DEM2014 search result concerns the Moon, not Toutatis.

Shared sky and font inputs retain their original licenses and acquisition pins. Runtime installation uses the generated body-specific asset inventory; source restoration and runtime delivery are separate checks.

</details>
