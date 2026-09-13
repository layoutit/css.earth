# Haumea

## Sources

The surface is unresolved. Its displayed color comes from the illustrative [NASA VTAD Haumea 3D model](https://science.nasa.gov/resource/haumea-3d-model/), not spacecraft mapping. The Dataset and Surface Lens panels expose it as “Illustrative model,” with the source credit and flat texture preview. No atmospheric layer is depicted.

The triaxial ellipsoid and equatorial ring use the nominal occultation/lightcurve solution in [Ortiz et al. (2017)](https://doi.org/10.1038/nature24051): semiaxes 1,161 × 852 × 513 km; ring radius 2,287 km and width 70 km. The preferred pole is J2000 RA 285.1°, declination −10.6°. This is an inferred shape, not a resolved mesh or unique interior model. Main text and Methods give different uncertainties for the middle axis (4 and 2 km); the nominal value agrees.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

The pole is observationally constrained, but the display meridian is arbitrary. A measured 3.915341-hour period does not establish an absolute orientation at the app epoch. The model does not animate a fictitious rotational ephemeris. The prepared orbital position and conic use the retained JPL physical-primary state (920136108) at JD 2461286.5 TT (2026-09-03), shared with Hiʻiaka. The pinned [primary vector](../hiiaka/source/orbit/haumea-epoch.txt) and [validated epoch record](../hiiaka/source/validation/epoch-state.json) retain the query, time-scale conversion, source hash and solution limits. This replaces the older heliocentric conic in the prepared scene; it is not a new long-term ephemeris.

Ring gray and fixed opacity are schematic. The ring has no invented bands and remains evenly lit. No separate Shadows control is used.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

Preparation samples the original GLB mesh and UV coordinates, including its polar islands, into the shared projective surface atlas. Only the base-color texture is used; its normal map and PBR material are not reproduced. The NASA model has semiaxes 1,161 × 852 × 569 km; its texture is transferred by normalized surface direction onto the published 1,161 × 852 × 513 km shape. The shared full-phase curvature raster is fitted to the projected triaxial ellipsoid, with its plane inside the retained 3D scene so the foreground ring can occlude it. This is illustrative flood lighting, not a measured reflectance model or a Sun-direction dark hemisphere. The base-color texture is unchanged.

1,444 body quads + 128 ring quads + one curvature quad = 1,573, below the 2,000-quad budget. Source parameters and acquisition recipes are kept here; the shared astronomy and sky sources supply the environment.

</details>
