# Haumea

No image resolves Haumea's surface: its long axis spans about 0.06 arcsec from 50 AU. The body is shown as its measured triaxial ellipsoid and ring. The Color dataset shows one colour for the whole body, computed from photometry of the unresolved disc. An Illustration dataset shows NASA artwork. One telescope, ALMA, resolves its outline; that picture is kept in the sidebar and described under [Telescope images](#telescope-images).

The [navigation marker](source/preparation/navigation.json) keeps the schematic silhouette and whole-disc color, with prepared full-phase curvature shading.

## Sources

| Quantity | Value | Source |
| --- | --- | --- |
| B−V, V−R, V−I | 0.626 ± 0.025, 0.343 ± 0.020, 0.683 ± 0.020 mag | [Rabinowitz et al. (2006)](https://doi.org/10.1086/499575), ApJ 639, 1238, section 3.4 and Table 3, weighted average of three nights with the rotational light curve subtracted ([arXiv:astro-ph/0509401](https://arxiv.org/abs/astro-ph/0509401)) |
| V geometric albedo | 0.51 ± 0.02 | [Ortiz et al. (2017)](https://doi.org/10.1038/nature24051), Methods, from the occultation area and the main body's absolute magnitude |
| Solar B−V, V−R, V−I | 0.653, 0.356, 0.701, each ± 0.003 mag | [Ramírez et al. (2012)](https://doi.org/10.1088/0004-637X/752/1/5), ApJ 752, 5, abstract (line-depth-ratio solution) |
| B, V, R, I effective wavelengths | 438.1, 544.5, 641.1, 798.2 nm | [SVO Filter Profile Service](http://svo2.cab.inta-csic.es/theory/fps/index.php?mode=browse&gname=Generic&gname2=Bessell), Generic/Bessell, checked 2026-09-16 |

The values are transcribed in [the colour record](source/photometry/disc-color.json). The [CIE 1931 2° colour-matching functions](https://doi.org/10.25039/CIE.DS.xvudnb9b) and [CIE standard illuminant D65](https://doi.org/10.25039/CIE.DS.hjfjmt59) are kept unchanged in [source/reference](source/reference).

The triaxial ellipsoid and equatorial ring use the nominal occultation/lightcurve solution in [Ortiz et al. (2017)](https://doi.org/10.1038/nature24051): semiaxes 1,161 × 852 × 513 km; ring radius 2,287 km and width 70 km. The preferred pole is J2000 RA 285.1°, declination −10.6°. This is an inferred shape, not a resolved mesh.

The Illustration dataset is not an observation. It shows the base-colour texture of NASA's [Haumea 3D Model](https://science.nasa.gov/resource/haumea-3d-model/), credited to NASA Visualization Technology Applications and Development (VTAD). The original GLB is pinned in [the manifest](source/manifest.json). NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)). The resource page does not say how the texture was made; its terrain, albedo pattern and colour are the artist's.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

### Telescope images

The sidebar keeps the one picture that shows Haumea as more than a point. It is not a dataset because nothing in it belongs to one side of Haumea: the outline repeats every half rotation, 1.96 hours, and four of the five sessions ran two hours, so each averages the whole cycle.

| Fact | Value | Where it is stated |
| --- | --- | --- |
| Project | [2022.1.01753.S](https://almascience.eso.org/aq/?projectCode=2022.1.01753.S), "First direct imaging of a dwarf planet's ring system", PI T. Müller, public since 2025-02-27 | ALMA archive metadata (`ivoa.obscore`), read 2026-09-19 |
| Sessions | 6, 8, 13 and 17 July 2023, two hours each, and 23 July 2023, 27 minutes | [QA2 report](https://almascience.eso.org/dataPortal/member.uid___A001_X35f5_Xb21.qa2_report.pdf), execution summary |
| Image | Pipeline aggregate continuum at 343.5 GHz (0.87 mm), 3.2 mas pixels, restoring beam 22.6 × 16.3 mas at position angle 12.7°, noise 0.013 mJy/beam | FITS header and QA2 report |
| Haumea in it | Peak 0.248 mJy/beam, 18 times the noise measured here beyond 150 mas (13.8 µJy/beam) | Measured here on the cutout, 2026-09-19 |

The archive's cutout is kept unchanged in [source/alma](source/alma). [The gallery record](source/alma/gallery.json) states everything done to it, and [fits-gallery-image.ts](../../../packages/bake/src/objects/charts/fits-gallery-image.ts) does it: a 96 × 96 pixel window centred on the brightest pixel, north up and east left, linear greys from −0.026 mJy/beam to the peak, each pixel drawn as an 8 × 8 square, stored lossless. Nothing is smoothed, sharpened, interpolated or deconvolved.

## Processing

The shared `disc-integrated-color` method ([disc-integrated-color.ts](../../../packages/bake/src/objects/color/disc-integrated-color.ts)) fills the surface atlas. Colour indices minus the solar ones give reflectance 1.025, 1, 0.988 and 0.984 at B, V, R and I. The spectrum through those points is integrated with the CIE 1931 observer under D65 and scaled so V reflectance equals the albedo, giving sRGB 188, 189, 191 (#bcbdbf). The navigation marker and catalogue colour use the same value.

For the Illustration, each texel is found through the model's own texture coordinates on its ellipsoid and placed on the measured triaxial shape at the same normalized direction; the texture is not repainted. Its longitudes are arbitrary. Color stays the default dataset, and the illustration never counts as imagery: Haumea stays "Shape only".

## Evidence

Each published colour uncertainty moves an sRGB channel by at most 2 of 255, and the albedo uncertainty moves every channel by 3. The [MBOSS](https://doi.org/10.26093/cds/vizier.35460115) three-epoch mean (B−V 0.631, V−R 0.370, V−I 0.687) gives 190, 189, 191. The Herschel and Spitzer albedo of 0.804 that Ortiz et al. (2017) replace would give 230, 232, 234.

The illustration's area-weighted mean colour is sRGB 112, 102, 96 (#706660) against the measured #bcbdbf; its linear luminance is about 27% of the measured colour's.

## Known problems

- The colour is a rotational mean. Haumea's light curve shows a darker, redder region ([Lacerda 2010](https://arxiv.org/abs/0911.0009)), so the real surface is not uniform; the region's size, position and contrast are not unique and are not drawn.
- The albedo depends on how much light Ortiz et al. (2017) remove for the ring (2.5%) and the moons Hiʻiaka and Namaka (about 11%). The published 0.51 is used unchanged.
- The colour assumes a straight-line spectrum between the four filter wavelengths, continued with the B−V slope below 438 nm. The effective wavelengths are SVO's values for Vega. The error this adds is not verified against a measured visible spectrum.
- The Illustration is far darker than the measured colour, and any dark or red area in it is not the region the light curve implies. It is shown as NASA published it.
- The ALMA picture averages over Haumea's rotation and shows no surface. The ring the project looked for cannot be made out in it; no ring analysis was tried here.
- The pole is observationally constrained, but the display meridian is arbitrary. The 3.915341-hour period does not establish an absolute orientation at the app epoch.
- The ring is drawn at the published opacity, 0.5 (Ortiz et al. 2017), in the neutral gray of a body without a measured colour. It has no invented bands and remains evenly lit.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
