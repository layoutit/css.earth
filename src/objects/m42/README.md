# Orion Nebula · M42

Two ESO source lenses paint one compiler emission field. The former 650 image-derived compact lights are replaced by the independently catalogued surrounding field described below. The saved Detail 100%, Faint 35%, Depth 1 and both registration matrices previously produced result `a5bdb41f1919160d14010649395451a4b89314ca291b1fa796454ecfb1d63887`, 841 nonempty slices per lens.

Sources: [ESO optical](https://www.eso.org/public/images/eso1723a/) and [ESO VISTA](https://www.eso.org/public/images/eso1006a/). Credits: ESO/G. Beccari; ESO/J. Emerson/VISTA and the Cambridge Astronomical Survey Unit. Original source pins remain in the lab recipes; [ESO rights](https://www.eso.org/public/outreach/copyright/) apply.

World placement adopts 414 ± 7 pc from [Menten et al. (2007)](https://arxiv.org/abs/0709.0485), with the registered image sky origin. Angular depth assumptions motivated by papers using other distances remain angular assumptions. The full field includes faint surrounding emission; its bounds are not a measured diameter of the bright Orion core.

The [physical evidence ledger](../../../labs/nebula/models/m42/physical-evidence.json) and [model notes](../../../labs/nebula/models/m42/README.md) separate measured constraints from authored extrapolation. The cloud model does not establish stellar membership. Follow the [shared preparation and validation guide](../../../docs/nebulae/README.md).

Known visual limits: rectangular optical coverage edges and pale residual structures outside the colored core remain from the assessed lab result. The current replay does not repair missing image coverage.

The shared dataset cards use the [source manifest](source/manifest.json) and [presentation record](source/presentation.json). Preparation generates the standard source-to-product provenance and small local image previews. These previews show the published photograph before star removal; source pixel counts describe image sampling, not telescope resolution. Preparing the cards checks their inputs and the installed volume identity, but does not rerun or scientifically validate the reconstruction.

## Current surrounding stars

The 14 September 2026 app delivery adds 1,500 shared lights from the pinned [stellar field](source/stellar-field.json): 2,780 Gaia DR3 rows inside a 50 pc sphere, selected at G < 14. The [shared method](../../../docs/nebulae/stellar-fields.md) records proper-motion propagation, Bailer-Jones distance uncertainty, photometric display scaling, radial fading and the 1,500-point budget. Stars are independent of the image footprint and are not confirmed nebula members.

The verified cloud replay is `2fb23ebbd6d508d188d44d43cab2200d248dbdccbb3d2bccf27dbf2b259ba414`. Resource hashes and source-card bindings passed with the new catalogue; cloud geometry and spectral images are unchanged by this starfield replacement. No new clean-cache native-processing claim is made.
