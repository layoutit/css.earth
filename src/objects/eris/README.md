# Eris

No image resolves Eris's surface. At about 96 AU its disc spans about 0.034 arcsec, two diffraction widths of an 8 m telescope. The Color dataset shows one colour for the whole body, computed from photometry of the unresolved disc. An Illustration dataset shows NASA's artwork.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| Quantity | Value | Source |
| --- | --- | --- |
| B−V, V−R, V−I | 0.823 ± 0.023, 0.391 ± 0.023, 0.777 ± 0.013 mag | [Carraro et al. (2006)](https://doi.org/10.1051/0004-6361:20066526), A&A 460, L39, section 4 ([arXiv:astro-ph/0610619](https://arxiv.org/abs/astro-ph/0610619)) |
| V geometric albedo | 0.96 +0.09/−0.04 | [Sicardy et al. (2011)](https://doi.org/10.1038/nature10550), Nature 478, 493, abstract |
| Solar B−V, V−R, V−I | 0.653, 0.356, 0.701, each ± 0.003 mag | [Ramírez et al. (2012)](https://doi.org/10.1088/0004-637X/752/1/5), ApJ 752, 5, abstract (line-depth-ratio solution) |
| B, V, R, I effective wavelengths | 438.1, 544.5, 641.1, 798.2 nm | [SVO Filter Profile Service](http://svo2.cab.inta-csic.es/theory/fps/index.php?mode=browse&gname=Generic&gname2=Bessell), Generic/Bessell, checked 2026-09-16 |

The values are transcribed in [the colour record](source/photometry/disc-color.json). The [CIE 1931 2° colour-matching functions](https://doi.org/10.25039/CIE.DS.xvudnb9b) and [CIE standard illuminant D65](https://doi.org/10.25039/CIE.DS.hjfjmt59) are kept unchanged in [source/reference](source/reference).

The radius is 1,163 ± 6 km from the November 6, 2010 stellar occultation reported by Sicardy et al. (2011), which is consistent with a spherical body. Rotation uses the 15.771 ± 0.008-day photometric period of [Bernstein et al. (2023)](https://arxiv.org/abs/2303.13445), consistent with synchronous rotation at Dysnomia's 15.78590-day orbital period. This supersedes the 25.9-hour value still on NASA's overview.

The Illustration dataset is not an observation. It is the base-colour texture of NASA's [Eris 3D Model](https://science.nasa.gov/resource/eris-3d-model/), credited to NASA Visualization Technology Applications and Development (VTAD), pinned in [the manifest](source/manifest.json). NASA does not say how the texture was made; its terrain, albedo pattern and colour are the artist's. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

Eris's scene position is the direct JPL Horizons geometric state at the fixed 2026-09-03 TT scene epoch, retained in its moon's package as [`dysnomia/source/orbit/eris-epoch.txt`](../dysnomia/source/orbit/eris-epoch.txt).

## Processing

The `disc-integrated-color` science kind ([disc-integrated-color.ts](../../../packages/bake/src/objects/color/disc-integrated-color.ts)) turns each colour index minus the solar index into reflectance relative to V, giving 0.855, 1, 1.033 and 1.073 at B, V, R and I. It joins those points with straight lines, integrates reflectance × D65 × the CIE 1931 functions from 380 to 780 nm, scales so V reflectance equals the albedo, and converts to sRGB: 255, 250, 234 (#fffaea). That colour fills the whole surface map, the navigation marker and the catalogue swatch.

The illustration is carried through the model's own texture coordinates onto the sphere and is not repainted. Its longitudes are arbitrary. Color stays the default dataset, and the illustration never counts as imagery: Eris stays "Shape only".

## Evidence

- The prepared surface, pole and thumbnail images decode to 255, 250, 234 on every opaque pixel, and so does the disc centre in the [default-view capture](source/reference/rendered-default-view.png).
- Sensitivity: B−V − 0.023 gives 255, 250, 237 and V−R − 0.023 gives 253, 249, 235. The MBOSS mean of 64 epochs gives 255, 250, 236. The albedo's lower bound, 0.92, gives 250, 245, 230.
- The illustration's area-weighted mean colour is #c9c0be; its linear luminance is about 57% of the measured colour's.

## Known problems

- The colour sits at the top of the sRGB range: linear red is 0.999. B−V + 0.023, V−R + 0.023 or an albedo of 1.00 would put red above 1, and the method refuses such a colour instead of clipping it. Within the published uncertainties Eris may be brighter or redder than the display can show.
- The colour assumes a straight-line spectrum between the four filter wavelengths. The effective wavelengths are SVO's values for Vega, not for Eris's spectrum. The error this adds is not verified against a measured spectrum.
- The rendered disc brightness under the shared lighting is not checked against the 0.96 albedo.
- The 2005 colours include light from the unresolved moon Dysnomia, about 0.02 mag. No correction is applied.
- A uniform colour hides any albedo pattern; none has been mapped.
- The Illustration dataset is darker than the measured colour and is shown as NASA published it.
- The body has no measured longitude origin or spin-pole registration. Its display pole and meridian are arbitrary.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
