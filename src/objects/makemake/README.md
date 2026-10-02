# Makemake

No image resolves Makemake's surface. The display uses a sphere at its approximate 715 km radius. The Color dataset shows one color for the whole body, computed from photometry of the unresolved disc, and an Illustration dataset shows NASA artwork.

The [navigation marker](source/preparation/navigation.json) keeps the schematic silhouette and whole-disc color, with prepared full-phase curvature shading.

## Sources

[NASA Science](https://science.nasa.gov/dwarf-planets/makemake/) supplies the approximate 715 km radius, 305-year orbital period and 45.8 AU average distance. The 22.83-hour rotation period is the 22.8266 ± 0.0001 h double-peaked lightcurve period that [Hromakina et al. (2019)](https://doi.org/10.1051/0004-6361/201935274) conclude; a single-peaked 11.4133 h solution also fits their data. [Ortiz et al. (2012)](https://doi.org/10.1038/nature11597) measured projected occultation axes of 1,430 ± 9 and 1,502 ± 45 km. Those sky-plane measurements do not uniquely define a three-dimensional shape or spin pole. The astronomy library uses a 738.8 km size scale from those two axes for orbital and capture metadata only. The mass is the combined Makemake and satellite mass from the satellite's preliminary orbit ([Bamberger 2025](https://arxiv.org/abs/2509.05880)).

| Quantity | Value | Source |
| --- | --- | --- |
| B−V, V−R, V−I | 0.91 ± 0.03, 0.41 ± 0.02, 0.65 ± 0.03 mag | [Hromakina et al. (2019)](https://doi.org/10.1051/0004-6361/201935274), A&A 625, A46, section 3.4 ([arXiv:1904.03679](https://arxiv.org/abs/1904.03679)) |
| V geometric albedo | 0.82 ± 0.02 | Hromakina et al. (2019), section 4 |
| Solar B−V, V−R, V−I | 0.653, 0.356, 0.701, each ± 0.003 mag | [Ramírez et al. (2012)](https://doi.org/10.1088/0004-637X/752/1/5), ApJ 752, 5, abstract (line-depth-ratio solution) |
| B, V, R, I effective wavelengths | 438.1, 544.5, 641.1, 798.2 nm | [SVO Filter Profile Service](http://svo2.cab.inta-csic.es/theory/fps/index.php?mode=browse&gname=Generic&gname2=Bessell), Generic/Bessell, checked 2026-09-16 |

The values are transcribed in [the color record](source/photometry/disc-color.json). Hromakina et al. found no color change with rotation, within the uncertainties. The [CIE 1931 2° color-matching functions](https://doi.org/10.25039/CIE.DS.xvudnb9b) and [CIE standard illuminant D65](https://doi.org/10.25039/CIE.DS.hjfjmt59) are kept unchanged in [source/reference](source/reference).

The Illustration dataset is not an observation. It shows the base-color texture of NASA's [Makemake 3D Model](https://science.nasa.gov/resource/makemake-3d-model/), credited to NASA Visualization Technology Applications and Development (VTAD). The original GLB is pinned in [the manifest](source/manifest.json). NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)). The resource page does not say how the texture was made; its terrain, albedo pattern and color are the artist's.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

The `disc-integrated-color` method ([disc-integrated-color.ts](../../../packages/bake/src/objects/color/disc-integrated-color.ts)) turns each color index minus the solar index into reflectance relative to V: 0.789, 1, 1.051 and 0.954 at B, V, R and I. It joins those points with straight lines, integrates them with the CIE 1931 functions under D65 from 380 to 780 nm, scales so V reflectance equals the albedo, and converts to sRGB with the IEC 61966-2-1 matrix. The result, sRGB 240, 233, 211 (#f0e9d3), fills the whole surface map. The navigation marker and catalogue color use the same value.

The Illustration texture is carried through the model's own texture coordinates onto the sphere and not repainted. Its longitudes are arbitrary. Color stays the default dataset, and the illustration never counts as imagery: Makemake stays "Shape only".

## Evidence

Each published color uncertainty moves an sRGB channel by at most 3 of 255 (B−V ± 0.03 moves blue from 211 to 209–214). The older MBOSS colors from Rabinowitz et al. (2007), which have no V−R, move blue to 218. A 10% lower albedo gives 229, 222, 202.

The illustration's area-weighted mean color is sRGB 160, 119, 103 (#a07767) against the measured #f0e9d3; its linear luminance is about 27% of the measured color's.

## Known problems

- The color assumes a straight-line spectrum between the four filter wavelengths, continued with the B−V slope below 438 nm. The effective wavelengths are SVO's values for Vega. The error this adds is not verified against a measured visible spectrum.
- The rendered disc brightness under the shared lighting is not checked against the albedo.
- Hromakina et al. note the albedo would be about 10% lower if an undetected satellite adds light. The published 0.82 is used unchanged.
- A uniform color hides any albedo pattern. Hromakina et al. mention that thermal modelling has needed two albedo terrains; no map of them exists.
- The Illustration is far darker and redder than the measured color. It is shown as NASA published it.
- Display pole and meridian are arbitrary. The rotation period does not drive an invented ephemeris.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
