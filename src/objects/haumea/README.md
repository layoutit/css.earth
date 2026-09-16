# Haumea

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

No image resolves Haumea's surface: its long axis spans about 0.06 arcsec from 50 AU. The Color lens shows one colour for the whole body, computed from photometry of the unresolved disc:

| Quantity | Value | Source |
| --- | --- | --- |
| B−V, V−R, V−I | 0.626 ± 0.025, 0.343 ± 0.020, 0.683 ± 0.020 mag | [Rabinowitz et al. (2006)](https://doi.org/10.1086/499575), ApJ 639, 1238, section 3.4 and Table 3, weighted average of three nights with the rotational light curve subtracted ([arXiv:astro-ph/0509401](https://arxiv.org/abs/astro-ph/0509401)) |
| V geometric albedo | 0.51 ± 0.02 | [Ortiz et al. (2017)](https://doi.org/10.1038/nature24051), Methods, from the occultation area and the main body's absolute magnitude |
| Solar B−V, V−R, V−I | 0.653, 0.356, 0.701, each ± 0.003 mag | [Ramírez et al. (2012)](https://doi.org/10.1088/0004-637X/752/1/5), ApJ 752, 5, abstract (line-depth-ratio solution) |
| B, V, R, I effective wavelengths | 438.1, 544.5, 641.1, 798.2 nm | [SVO Filter Profile Service](http://svo2.cab.inta-csic.es/theory/fps/index.php?mode=browse&gname=Generic&gname2=Bessell), Generic/Bessell, checked 2026-09-16 |

The values are transcribed in [the colour record](source/photometry/disc-color.json). The [CIE 1931 2° colour-matching functions](https://doi.org/10.25039/CIE.DS.xvudnb9b) and [CIE standard illuminant D65](https://doi.org/10.25039/CIE.DS.hjfjmt59) are kept unchanged in [source/reference](source/reference), the same files Makemake uses; their sha256 values equal the checksums in CIE's dataset metadata.

The triaxial ellipsoid and equatorial ring use the nominal occultation/lightcurve solution in [Ortiz et al. (2017)](https://doi.org/10.1038/nature24051): semiaxes 1,161 × 852 × 513 km; ring radius 2,287 km and width 70 km. The preferred pole is J2000 RA 285.1°, declination −10.6°. This is an inferred shape, not a resolved mesh or unique interior model. Main text and Methods give different uncertainties for the middle axis (4 and 2 km); the nominal value agrees.

## Evidence

Run of 2026-09-16 (this version): `node tools/prepare-object.mts haumea` prepared the package with the Color lens. `node --test tools/objects/observation/disc-integrated-color.test.mts tests/objects/unit/haumea/shape.test.mts site/test/object-discovery.test.mts` passes.

Measured sensitivity, with the same method: each published colour uncertainty moves an sRGB channel by at most 2 of 255 (B−V ± 0.025 moves blue from 191 to 189–193), and the albedo uncertainty moves every channel by 3. The [MBOSS](https://doi.org/10.26093/cds/vizier.35460115) three-epoch mean (B−V 0.631, V−R 0.370, V−I 0.687) gives 190, 189, 191. The Herschel and Spitzer albedo of 0.804 that Ortiz et al. (2017) replace would give 230, 232, 234.

## Known problems

- The colour is a rotational mean. Haumea's light curve shows a darker, redder region ([Lacerda 2010](https://arxiv.org/abs/0911.0009)), so the real surface is not uniform; the region's size, position and contrast are not unique from the light curve and are not drawn.
- The albedo depends on how much light Ortiz et al. (2017) remove for the ring (2.5%) and the moons Hiʻiaka and Namaka (about 11%). They note it would be lower if those shares are larger. The published 0.51 is used unchanged.
- The colour assumes a straight-line spectrum between the four filter wavelengths, continued with the B−V slope below 438 nm. The effective wavelengths are SVO's values for Vega, not for Haumea's spectrum. The error this adds is not verified against a measured visible spectrum.
- The texture value is scaled to the V geometric albedo. The rendered brightness under the shared lighting is not checked against that albedo.
The pole is observationally constrained, but the display meridian is arbitrary. A measured 3.915341-hour period does not establish an absolute orientation at the app epoch. The model does not animate a fictitious rotational ephemeris. The prepared orbital position and conic use the retained JPL physical-primary state (920136108) at JD 2461286.5 TT (2026-09-03), shared with Hiʻiaka. The pinned [primary vector](../hiiaka/source/orbit/haumea-epoch.txt) and [validated epoch record](../hiiaka/source/validation/epoch-state.json) retain the query, time-scale conversion, source hash and solution limits. This replaces the older heliocentric conic in the prepared scene; it is not a new long-term ephemeris.

Ring gray and fixed opacity are schematic. The ring has no invented bands and remains evenly lit. No separate Shadows control is used.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

Preparation fills the shared projective surface atlas with the measured colour through the shape-model route's `surface` block, which runs the shared `disc-integrated-color` method ([disc-integrated-color.mts](../../../tools/objects/observation/disc-integrated-color.mts)). Colour indices minus the solar ones give reflectance 1.025, 1, 0.988 and 0.984 at B, V, R and I. The spectrum through those points is integrated with the CIE 1931 observer under D65 and scaled so V reflectance equals the albedo, giving linear sRGB 0.504, 0.511, 0.522 and sRGB 188, 189, 191 (#bcbdbf). The navigation marker and catalogue colour use the same value. The ring, lighting and poles are prepared as before; no model texture is sampled.

1,444 body quads + 128 ring quads + one curvature quad = 1,573, below the 2,000-quad budget. Source parameters and acquisition recipes are kept here; the shared astronomy and sky sources supply the environment.

</details>
