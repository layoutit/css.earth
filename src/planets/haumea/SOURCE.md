# Haumea

The surface is unresolved. Its displayed color comes from the illustrative [NASA VTAD Haumea 3D model](https://science.nasa.gov/resource/haumea-3d-model/), not spacecraft mapping. There is no distinct observational dataset to offer as a surface lens, so the shared shell exposes no lens selector. No atmospheric layer is depicted.

The triaxial ellipsoid and equatorial ring use the nominal occultation/lightcurve solution in [Ortiz et al. (2017)](https://doi.org/10.1038/nature24051): semiaxes 1,161 × 852 × 513 km; ring radius 2,287 km and width 70 km. The preferred pole is J2000 RA 285.1°, declination −10.6°. This is an inferred shape, not a resolved mesh or unique interior model. Main text and Methods give different uncertainties for the middle axis (4 and 2 km); the nominal value agrees.

The pole is observationally constrained, but the display meridian is arbitrary. A measured 3.915341-hour period does not establish an absolute orientation at the app epoch. The model does not animate a fictitious rotational ephemeris. Orbital position uses the existing vendored JPL Kepler elements at the shared 2026-09-04 epoch.

Preparation samples the original GLB mesh and UV coordinates, including its polar islands, into the shared projective surface atlas. Only the base-color texture is used; its normal map and PBR material are not reproduced. The NASA model has semiaxes 1,161 × 852 × 569 km; its texture is transferred by normalized surface direction onto the published 1,161 × 852 × 513 km shape. The texture is evenly flood lit: no extra Sun-direction attenuation or dark hemisphere is baked onto it. This is an illustration, not a measured albedo texture. Ring gray and fixed opacity are schematic. The ring has no invented bands. The schematic ring is evenly lit as well. No spherical lighting overlay or separate Shadows control is used.

Preparation: `node tools/objects/dist/prepare-authored.js haumea --write`. Geometry is prepared once: 1,444 body quads + 128 ring quads = 1,572, below the 2,000-quad budget. Source parameters and acquisition recipes are kept here; the shared astronomy and sky sources supply the environment.
