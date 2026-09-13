# Helix Nebula · NGC 7293

Three lenses paint one emission field: [ESO WFI optical](https://www.eso.org/public/images/eso0907a/), [ESO VISTA infrared](https://www.eso.org/public/images/eso1205a/) and the wider ESO field recorded in the observation recipe. Original URLs and credits remain in those recipes and the lens card; [ESO rights](https://www.eso.org/public/outreach/copyright/) apply.

Delivery replays the documented assessed Detail 65%, Faint 35%, Depth 1 settings. The historical result is `2e6d9eccd15ca15ccc053b1d564e2b0763522207c1c6ba79c42c86111796c9ce`; an earlier replay produced `6e28fbc4c15ac08a5175379b941b76ce04b3e307770a50008e8c991c12c4b8a6`, with 650 image-derived lights and 305 nonempty slices per lens. The latest delivery is recorded below; it does not claim identical historical pixels. Neither failed old single-axis nor shape-prior volume is delivered.

Placement adopts 216 −12/+14 pc from [Benedict et al. (2009)](https://arxiv.org/html/0909.4281), with the molecular-source ICRS sky origin. Velocity measurements constrain only part of the field; halo depth and front/back emission allocation remain assumptions.

The [lab source record](../../../labs/nebula/models/helix/README.md) covers limitations. Follow the [shared preparation and validation guide](../../../docs/nebulae/README.md).

The shared dataset cards use the [source manifest](source/manifest.json) and [presentation record](source/presentation.json). Preparation generates the standard source-to-product provenance and small local image previews. These previews show the published photograph before star removal; source pixel counts describe image sampling, not telescope resolution. Preparing the cards checks their inputs and the installed volume identity, but does not rerun or scientifically validate the reconstruction.

## Current surrounding stars

The 14 September 2026 app delivery adds 1,500 shared lights from the pinned [stellar field](source/stellar-field.json): 6,627 Gaia DR3 rows inside a 50 pc sphere, selected at G < 16. The [shared method](../../../docs/nebulae/stellar-fields.md) records proper-motion propagation, Bailer-Jones distance uncertainty, photometric display scaling, radial fading and the 1,500-point budget. Stars are independent of the image footprint and are not confirmed nebula members.

The verified cloud replay is `26c8c2b43cd55398b8ee3489e66ae8944a867f52b8cfa5a72f0af3d4361b9597`. Resource hashes and source-card bindings passed with the new catalogue; cloud geometry and spectral images are unchanged by this starfield replacement. No new clean-cache native-processing claim is made.
