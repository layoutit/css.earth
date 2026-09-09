# 137P/Shoemaker–Levy 2

[Donaldson’s thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) supplies the physical axis ratios and nominal pole (Table 4.3, Model 1; section 4.3.1.1; Table 4.5). [SEPPCoN](https://doi.org/10.1016/j.icarus.2013.07.021) supplies the thermal radius. Exact numeric constraints, alternative model dispositions, uncertainties and source hashes are in source/shape/model.json and source/reference/source-record.json.

The preparation tessellates a smooth ellipsoid with these axis ratios. Scaling the thermal effective radius as a volume-equivalent radius is an explicit display convention; it does not establish a measured volume or absolute axis lengths. The original convex mesh was not obtained. No surface texture, concavity, bilobate structure or current rotational phase is claimed. X is the longest axis; Z follows the nominal spin pole. The J2000 ecliptic pole is converted with the Horizons-compatible obliquity of 84381.448 arcseconds.

The shared preparer reduces 2,048 input triangles to 800 native PolyCSS triangles and bakes missing-imagery grid, smooth normals and both lighting states. Shadows default off. All work happens before runtime.

Reproduce with `node tools/objects/dist/prepare-authored.js comet-137p --write` after restoring sources through the acquisition recipe. Install published runtime assets with `pnpm setup:assets --object=comet-137p`. Original thesis bytes are linked and hashed, not redistributed.
