# Shape-only material

Every terrestrial `shapeViews` lens uses the same neutral gray: **#808080 in
sRGB**. This is a cssEarth display convention, not measured color, physical
albedo, or a NASA/OpenSpace standard. The model supplies the shape; the material
adds no craters, mottling, grid lines, or other invented surface detail.

Photographic, observed-color, and scientific lenses retain their own pixels.
Their missing-data grid continues to mark rejected or unavailable samples.
A shape-only lens still records that surface imagery is absent.

## Lighting

The material changes the base color. Existing prepared lighting remains separate:
the ordinary mesh path uses interpolated vertex normals and the prepared Sun
direction; models with source-cast lighting keep that source-mesh calculation.
Shadows off uses gentle baked shading from the same interpolated mesh normals
and Sun direction. A broad fill ranges from 55% to 100% of the base gray,
including the back-facing side, so there is no hard terminator or cast shadow.
This is illustrative shape lighting, not a measured brightness map. Shadows on
retains the stronger existing directional and source-cast lighting unchanged.
Context previews retain
their declared camera and full-phase lighting. These display orientations are
not necessarily a measured rotational attitude.

Kleopatra, at the same camera angle with Shadows off: the intermediate uniform
gray material hid its relief; the gentle bake makes the source shape readable.

| Uniform gray | Gentle baked shading |
| --- | --- |
| ![Kleopatra with uniform gray](images/shape-only-material/shadows-off-before.png) | ![Kleopatra with gentle shape shading](images/shape-only-material/shadows-off-after.png) |

## Preparation

[shape-material.mts](../tools/objects/terrestrial-layers/shape-material.mts) owns
the color. The full terrestrial preparer uses it for every shape view. A constant
material avoids cylindrical image sampling when baking the ordinary mesh atlas;
its encoded default and Shadows-on lighting are checked against the general texture path.

To update only the default lighting in an already-neutral checkout:

```sh
node tools/objects/refresh-shape-lighting.mts stage --all
node tools/objects/refresh-shape-lighting.mts publish --all
node tools/prepare-machines.mts
```

Staging prepares replacement atlases without changing the served assets.
Publication checks that the retained packages and lighting generator still match
the staged inputs, atomically replaces only the default atlases, and updates
their asset pins and provenance. Shadows-on, base maps, previews, geometry, and
other datasets are retained. Receipts in `output/shape-default-lighting` record
the original asset hashes and the replacements. Individual body ids may replace
`--all` for a focused browser preview.

For a complete material refresh, run:

```sh
node tools/objects/refresh-shape-materials.mts --all --resume
node tools/prepare-machines.mts
```

The refresh retains each lens's triangles, atlas addresses, camera, and other
datasets. It regenerates surfaces, shadows, thumbnails, minimaps, and model
context images, then updates their pins and provenance. The second command
rebuilds the sources catalogue from those updated pins; run it after the batch,
before reopening the app. It replaces local asset
files atomically, preserving the original read-only inodes. `--source-root=PATH`
can supply missing original meshes from another checkout for source-cast lighting;
that checkout is only read. Receipts live in ignored `output/shape-material-refresh`.

Refresh provenance identifies the retained prepared geometry; it does not claim
to have reacquired or rebuilt every original scientific source. The source
recipes and full preparation path remain the reproduction owners.
