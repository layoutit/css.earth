# Makemake

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

[NASA Science](https://science.nasa.gov/dwarf-planets/makemake/) supplies the approximate 715 km radius, 305-year orbital period and 45.8 AU average distance. The 22.83-hour rotation period is the 22.8266 ± 0.0001 h double-peaked lightcurve period that [Hromakina et al. (2019)](https://doi.org/10.1051/0004-6361/201935274) conclude; a single-peaked 11.4133 h solution also fits their data. The display uses a sphere at that approximate radius. [Ortiz et al. (2012)](https://doi.org/10.1038/nature11597) measured projected occultation axes of 1,430 ± 9 and 1,502 ± 45 km. Those sky-plane measurements do not uniquely define a three-dimensional shape or spin pole; this package does not claim otherwise. The astronomy library uses a 738.8 km size scale from those two projected axes for orbital and capture metadata only, and says so. Its mass is the combined Makemake and satellite mass from the satellite's preliminary orbit ([Bamberger 2025](https://arxiv.org/abs/2509.05880)).

No image resolves Makemake's surface. The Color lens shows one colour for the whole body, computed from photometry of the unresolved disc:

| Quantity | Value | Source |
| --- | --- | --- |
| B−V, V−R, V−I | 0.91 ± 0.03, 0.41 ± 0.02, 0.65 ± 0.03 mag | [Hromakina et al. (2019)](https://doi.org/10.1051/0004-6361/201935274), A&A 625, A46, section 3.4 ([arXiv:1904.03679](https://arxiv.org/abs/1904.03679)) |
| V geometric albedo | 0.82 ± 0.02 | Hromakina et al. (2019), section 4 |
| Solar B−V, V−R, V−I | 0.653, 0.356, 0.701, each ± 0.003 mag | [Ramírez et al. (2012)](https://doi.org/10.1088/0004-637X/752/1/5), ApJ 752, 5, abstract (line-depth-ratio solution) |
| B, V, R, I effective wavelengths | 438.1, 544.5, 641.1, 798.2 nm | [SVO Filter Profile Service](http://svo2.cab.inta-csic.es/theory/fps/index.php?mode=browse&gname=Generic&gname2=Bessell), Generic/Bessell, checked 2026-09-16 |

The values are transcribed in [the colour record](source/photometry/disc-color.json). Hromakina et al. found no colour change with rotation, within the uncertainties. The [CIE 1931 2° colour-matching functions](https://doi.org/10.25039/CIE.DS.xvudnb9b) and [CIE standard illuminant D65](https://doi.org/10.25039/CIE.DS.hjfjmt59) are kept unchanged in [source/reference](source/reference); their sha256 values equal the checksums in CIE's dataset metadata.

The Illustration lens is not an observation. It shows the base-colour texture of NASA's [Makemake 3D Model](https://science.nasa.gov/resource/makemake-3d-model/), credited to NASA Visualization Technology Applications and Development (VTAD). The original GLB is pinned in [the manifest](source/manifest.json) (4,441,844 bytes); on 2026-09-18 NASA's server still returned the same size, last modified 2024-10-19. The resource page gives only a one-line description and the credit; it does not say how the texture was made. Because no image resolves Makemake, its terrain, albedo pattern and colour are the artist's. Preparation carries the texture through the model's own texture coordinates onto the displayed sphere and does not repaint it. The map's left edge is the texture's own 0° column, so its longitudes are arbitrary. Color stays the default lens. The illustration is listed in the package's illustration lenses, so it never counts as imagery: Makemake stays "Shape only". NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

Run of 2026-09-18 (this version): preparation added the Illustration lens and dropped the 35 unused 1x files. The 36 files kept, including every Color lens image, are byte-identical to the previous pins. Discovery is unchanged: no imagery, not illustration-only. Measured this session, the illustration's area-weighted mean colour is sRGB 160, 119, 103 (#a07767) against the measured #f0e9d3; its linear luminance is about 27% of the measured colour's.

Run of 2026-09-16: `node tools/prepare/prepare-object.mts makemake` prepared the package with the Color lens. `node --test tools/objects/observation/disc-integrated-color.test.mts site/test/object-discovery.test.mts tests/objects/unit/makemake/runtime-contract.test.mts` passes.

Measured sensitivity, with the same method: each published colour uncertainty moves an sRGB channel by at most 3 of 255 (B−V ± 0.03 moves blue from 211 to 209–214). The older MBOSS colours from Rabinowitz et al. (2007), which have no V−R, move blue to 218. A 10% lower albedo gives 229, 222, 202.

## Known problems

- The colour assumes a straight-line spectrum between the four filter wavelengths, continued with the B−V slope below 438 nm. The effective wavelengths are SVO's values for Vega, not for Makemake's spectrum. The error this adds is not verified against a measured visible spectrum.
- The texture value is scaled to the V geometric albedo (0.82). The rendered disc brightness under the shared lighting is not checked against that albedo.
- Hromakina et al. note the albedo would be about 10% lower if an undetected satellite adds light. The published 0.82 is used unchanged.
- A uniform colour hides any albedo pattern. Hromakina et al. mention that thermal modelling has needed two albedo terrains; no map of them exists.
- The Illustration lens is far darker and redder than the measured whole-disc colour (see Evidence). The illustration is shown as NASA published it; no colour is corrected.
- Display pole and meridian are arbitrary, explicitly recorded as such. The reported rotation period is content only and does not drive an invented ephemeris. Orbital placement uses the existing pinned JPL elements at the shared 2026-09-03 TT epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

Preparation uses the shared raster path and generic object adapter: 16 latitude by 32 longitude segments, with prepared poles, 452 body quads plus one lighting quad (453 total). No runtime source parsing or rasterization.

The `disc-integrated-color` science kind ([disc-integrated-color.mts](../../../tools/objects/observation/disc-integrated-color.mts)) turns each colour index minus the solar index into reflectance relative to V: B = 10^(−0.4 Δ(B−V)), R = 10^(0.4 Δ(V−R)), I = 10^(0.4 Δ(V−I)), which gives 0.789, 1, 1.051 and 0.954. It joins those four points with straight lines, integrates reflectance × D65 × the CIE 1931 functions from 380 to 780 nm in 1 nm steps, divides by the D65 luminance, scales so V reflectance equals the albedo, and converts XYZ to linear sRGB with the IEC 61966-2-1 matrix. The result, linear 0.869, 0.811, 0.654 and sRGB 240, 233, 211 (#f0e9d3), fills the whole surface map. The prepared lighting applies the Sun's tint separately. The navigation marker and catalogue colour use the same value.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 715 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 0.951108-day prograde rotation (Hromakina et al. 22.8266 h from measurements.json; display orientation arbitrary) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 20.00° initial pitch, -50.00° yaw, taken from the retired lane's camera). 

</details>
