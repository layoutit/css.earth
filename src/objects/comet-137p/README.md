# 137P/Shoemaker–Levy 2

The navigation snapshot uses the same retained shape and viewing direction, with prepared full-phase lighting (35% ambient, 65% diffuse). Its neutral gray material remains a display convention without observed surface detail. The snapshot recipe is recorded in [the source manifest](source/manifest.json); the selected-body geometry and scientific assets are unchanged.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

[Donaldson’s thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) supplies the physical axis ratios and nominal pole (Table 4.3, Model 1; section 4.3.1.1; Table 4.5). [SEPPCoN](https://doi.org/10.1016/j.icarus.2013.07.021) supplies the thermal radius. Exact numeric constraints, alternative model dispositions, uncertainties and source hashes are in source/shape/model.json and source/reference/source-record.json.

The preparation tessellates a smooth ellipsoid with these axis ratios. Scaling the thermal effective radius as a volume-equivalent radius is an explicit display convention; it does not establish a measured volume or absolute axis lengths.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

The original convex mesh was not obtained. No surface texture, concavity, bilobate structure or current rotational phase is claimed.

Original thesis bytes are linked and hashed, not redistributed.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

X is the longest axis; Z follows the nominal spin pole. The J2000 ecliptic pole is converted with the Horizons-compatible obliquity of 84381.448 arcseconds.

The shared preparer reduces 2,048 input triangles to 800 native PolyCSS triangles and bakes missing-imagery grid, smooth normals and both lighting states. Shadows default off. All work happens before runtime.

</details>
