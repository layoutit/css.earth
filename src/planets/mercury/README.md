# Mercury

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Monochrome | USGS MESSENGER MDIS BDR, supplied through pinned OpenSpace WMS; NAC or WAC 750 nm reflectance imagery. |
| Enhanced color | USGS MDIS 665 m mosaic through NASA Treks WMTS. False color: PC2/PC1/430-to-1000 nm ratio. Missing polar pixels receive an explicitly modeled completion. |
| Topography | USGS global color shaded relief, with its published elevation legend; false color. |
| Interior | [NASA facts](https://science.nasa.gov/mercury/facts/), retrieved 2026-08-30. A 0.85-radius metallic core and combined mantle/crust shell; colors and fine texture are illustrative. |
| Spectrum | DLR/Zenodo MASCS one-degree cube, [10.5281/zenodo.7433033](https://doi.org/10.5281/zenodo.7433033). The 326-point spectrum is a global area-weighted mean over 350–1000 nm. |

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

The interior’s shape shading is illustrative in both exterior-lighting states.

Filled enhanced-color poles are not direct observations. The 366 km rendered outer shell is the difference between the cited radii; NASA separately describes it as “about 400 km.” The sky and display rotation are contextual, not an epoch-correct observation. The PSG source specifies no atmosphere structure, so no temperature-pressure chart is supplied.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="mercury-sources"></a>

<details>
<summary>Methods and source notes</summary>

- Default surface: the USGS MESSENGER MDIS Map Projected Basemap RDR (BDR), acquired through the pinned OpenSpace WMS declaration. Its own source declaration identifies the one-band product as a global monochrome reflectance map compiled from NAC or WAC 750 nm images. No display color is added.
- Enhanced lens: the official NASA Solar System Treks level-3 WMTS matrix for the USGS MESSENGER MDIS 665 m enhanced-color global mosaic. The 16-by-8 tile matrix is stitched without resampling into a 4096-by-2048 source snapshot. The USGS product has neutral-black no-data near the poles. Preparation completes only those pixels with latitude-coherent observed enhanced chroma and local BDR detail, falling back to the complete topography product where BDR is also absent. Dedicated pole assets use the observed outer-cap chroma with BDR detail to avoid an equirectangular pole singularity. The lens remains false color; prepared completion does not claim direct enhanced-color observations in filled regions. The published channel encoding uses principal components 2 and 1 in red and green, and the 430/1000 nm ratio in blue. That construction remains provenance rather than a viewing legend because it does not assign terrain classes to colors.
- Topography lens: the USGS MESSENGER global color shaded-relief product, acquired through its pinned OpenSpace WMS declaration. It is false color. Its optional elevation legend is prepared from the ancillary legend published with the official USGS product; the default 750 nm lens has no legend.
- Navigation marker: NASA/JHU APL/Carnegie MESSENGER global view, PIA15162.
- Physical facts and retained 3D cutaway: NASA Science's Mercury facts record, retrieved 2026-08-30. The only radial boundary claimed is the 0.85-radius metallic core; mantle and crust remain one combined outer shell. The rendered 366 km shell is the arithmetic difference between NASA's published 2,440 km planet radius and 2,074 km core radius, while the source's separate “about 400 km” statement is retained as an approximate published value. Interior colors and fine texture are explicitly declared illustrative presentation choices, and the optional Interior legend is marked schematic while using the exact prepared presentation palette. Preparation applies source-qualified depth/contact shading to the section faces, prepared object-space lighting to the retained core and outer cutaway, and a dedicated high-resolution default exterior light frame. None is represented as a direct observation or as sunlight inside Mercury.
- Cutaway preparation follows the accepted Saturn presentation schema: the same wedge is removed from the exterior and the 8-by-32 retained metallic-core sphere, including their lossless DPR-specific polar assets, ahead of runtime. The two radial section faces occupy separate halves of a lossless 2048-by-2048 logical atlas (4096-by-4096 at DPR 2). A prepared presentation-only pitch assist begins above 55 degrees of camera control so the meridional section remains readable in the pole-on lens; it does not change Mercury's physical axial-tilt claim. These are prepared presentation mechanics, not additional claims about Mercury's measured internal boundaries.
- Surface spectrum: a 326-point, 350–1000 nm global area-weighted mean prepared from M. D'Amore's DLR/Zenodo MESSENGER MASCS one-degree spectral cube (DOI `10.5281/zenodo.7433033`, CC-BY-4.0). The committed snapshot records the exact 197,099,868-byte archive identity, aggregation rule, parsed counts, and the archive/record count discrepancy.
- Atmospheric context: a pinned NASA GSFC Planetary Spectrum Generator configuration explicitly reports `ATMOSPHERE-STRUCTURE` as `None`. Mercury's thin exosphere is described separately, so the object package deliberately publishes no temperature-pressure chart.
- Background sky and Sun: ESO's 6000-by-3000 `eso0932a` photographic full-sky panorama by S. Brunier, licensed CC-BY-4.0, is projected during preparation into six 1024-square retained CSS cubemap faces and six 2048-square DPR-2 faces. The shared Venus cubic-sky standard owns the fixed black point 8, gamma 1.2, gain 0.6, wrapped Gaussian diffuse separation, registered Galactic orientation, inverse camera response, weak 0.12 field-of-view zoom response, and Sun presentation. The exact locally retained Google Maps Sun oracle input is median-filtered and levelled once, then direction-space composited into the six prepared faces without a radial mask. It is not a runtime billboard or overlay. The HYG v4.1 subset by David Nash/Astronexus (CC-BY-SA-4.0) remains the coordinate-registration audit; it does not render a second star layer. This is a photographed full sky and presentation-derived Sun direction, not an epoch-correct Mercury observer sky or ephemeris claim.
- Renderer dimensions: the OpenSpace Mercury globe declaration at commit `56e29b54b8592084ff1fef47c2e08de0b22ce516`.
- Prepared lighting: exact Oren-Nayar and shaded-color excerpts from OpenSpace's pinned globe shader. Mercury uses its zero-roughness Lambert result, 0.05 ambient term, and 0.0–0.1 terminator smoothstep without an atmospheric or limb term. Preparation stores 256 complete light-view phase frames at each DPR. The camera transforms the same fixed direction used by the baked cube Sun, selects the nearest prepared phase from view-space light Z, and rotates that retained overlay to the same view-space azimuth; no lighting pixels are calculated at runtime. The optional shadowless presentation reuses the final view-aligned frame with a declared 0.35 flood-light limb floor. This limits its center-to-limb lighting ratio to about 2.9:1, preserving spherical curvature without the near-black edge treatment of the directional source light. This presentation-only floor does not change any directional-light frame.
- Title vector: Inter Variable 4.001 at commit `9221beed3`, used only during preparation.

</details>
