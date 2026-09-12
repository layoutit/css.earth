# 9P/Tempel 1

## Sources

- The original [Farnham & Thomas (2013) PDS dataset](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_its_mri-5-tempel1-shape-v2.0/dataset.shtml) supplies 16,022 planetocentric vertices and 32,040 zero-indexed triangles.

- 9P/Tempel 1 was visited by Deep Impact in 2005 and Stardust-NExT in 2011.

- The [PDS Tempel 1 shape-model release, version 2.0](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=DIF-C-HRIV%2FITS%2FMRI-5-TEMPEL1-SHAPE-V2.0) records the Deep Impact site at about 16° east, 28° south in its `TEMPEL1_2012_PLAN` frame.

## Photographic views

**Deep Impact** combines eight archived ITS photographs from the 2005 approach. Three cropped close-ups add finer ridges and depressions within the existing view; source sampling reaches 3.1 m/pixel in a small patch. They improve detail over about 6.6 km² of the displayed surface. Total photographic coverage remains around 31%.

**Stardust-NExT** retains its separate six-image 2011 view. These are photographs with their original illumination, not albedo or change maps. The grid marks unsupported image/shape correspondence. Shadows defaults to Off.

Both use the original [NASA PDS imagery](https://pdssbn.astro.umd.edu/holdings/dii-c-its-3_4-9p-encounter-v3.0/dataset.shtml) and fixed 2012 source shape. The display stays at 1000 triangles. The [photography method note](source/reference/encounter-photography.md) explains camera registration, image quality, alternative sources, uncertainty and reproducible preparation.

## Evidence

- The [close-up comparison and browser record](evidence/closeups/README.md) show the eight-image result at the same camera and at DPR 1 and 2.

- The [constraint-grid qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/CONSTRAINT-GRIDS.md) records checks and captured views.

- The [shared qualification record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/QUALIFICATION.md) records verification.

- **Surface place, 2026-09-12:** preparation and the runtime parser accepted the
  Deep Impact site; three focused unit tests passed. On base `53b262bd` with this
  addition, searching for the site and switching to the 2005 photographs showed
  its qualified caption. [Browser capture](evidence/surface-places.png).
  The published catalog passed a fresh byte-count and SHA-256 check.

## Known problems

- Close-up registration measures alignment with an earlier photograph. Absolute placement still inherits the limb anchor and coarse shape model’s uncertainty; this is not a precise survey of the impact site.

- The Deep Impact label is one approximate point, not a surveyed crater centre or boundary. Its 16° east, 28° south position follows the PDS 2012 shape model's east-positive, planetocentric frame; it is not transferred between the photographic views.

- The default Source constraints lens uses solid gray for stereo control, blue for limb silhouettes, and the shared gray grid for poorly constrained regions. The grid means poorly constrained by those methods, not necessarily wholly unobserved. Neither view claims observed albedo.

- Flag counts are vertex counts, not surface-area percentages. Weak regions are the original authors' estimates, not additional cssEarth terrain.

- Rotational phase is arbitrary and held fixed; no encounter or current rotation reconstruction is claimed.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="9ptempel-1-source-and-interpretation"></a>

Kilometres convert to metres; east-positive longitude and north-positive latitude define the released right-handed frame. Original table, label and catalogue bytes are pinned in source/manifest.json.

Their images constrain the published nucleus model. 480 stereo control points on about 70% of the nucleus. The combined model pole is retained at RA 255°, Dec +64.5°.

All published geometry is retained before simplification. Flag 1 means stereo control (11104 vertices), flag 2 limb silhouette (1450), and flag 3 not well constrained (3468). The Shape model view uses the same grid for flag 3 and neutral gray for flags 1 and 2. Nearest 2-degree grid sampling prepares the categorical map; raster filtering softens visual category boundaries and is not a quantitative uncertainty interpolation.

The published equivalent-volume radius 2.83 km supplies scale only; it does not replace the mesh. No measured mass or GM is claimed (the astronomy registry uses its existing zero-for-unknown convention). JPL Horizons elements at JD 2461286.5 supply heliocentric placement; the conic omits perturbations and outgassing. Lighting uses that common epoch and the declared display orientation, not a reconstruction of encounter photographs. No dust, tails, jets or tumble simulation is included.

Meshoptimizer retains original source vertices and closed, consistently wound connectivity, reduced to 1000 triangles. Estimated simplification error 25.353675842285156 m is neither a measurement uncertainty nor a Hausdorff bound. Original-mesh normals and cast shadows are baked into fixed atlases; no geometry, maps or illumination are computed at runtime.

The source grid is selected by categorical flags before raster filtering and lighting. Both atlases per lens, their thumbnails, the constraint minimap, and the model-view context image/navigation marker use the same preparation. Geometry, native triangle leaves, camera and lighting recipes are unchanged.

</details>
