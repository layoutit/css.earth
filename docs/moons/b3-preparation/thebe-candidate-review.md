# Thebe C0420644201R: source opportunity rejected after pixel inspection

The additional low-phase Galileo frame is geometrically useful but does not provide a usable image footprint under the existing preparation policy. **Do not add it to the five-frame package.** This is a decision about this product; Thebe remains in the B3 review scope.

The [original REDR image](https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0020/E11/SML_SATS/C0420644201R.IMG), [detached label](https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0020/E11/SML_SATS/C0420644201R.LBL) and [OPUS record](https://opus.pds-rings.seti.org/opus/api/metadata/go-ssi-c0420644201.json) identify the 1997-11-06T23:36:51.090Z exposure: observer22.404°W/0.395°N, Sun32.020°W/1.316°N, 846,606.75km range, 8.59557km per native pixel and9.658° phase. The old label's solar longitude318.882° belongs to stale target context and is not used. Native camera north follows SSI NORTH_AZIMUTH+90 =354.366°. The label's image centre was used only as an unregistered diagnostic position, never adopted as a fitted camera.

The attached VICAR header and detached label agree on the original800×800 BYTE raster: image offset10,000 bytes, 1,000 bytes per line including200 prefix bytes. The transmitted cutout is112×112; DN/255 is relative detector brightness, not calibrated I/F. In the inspected cutout the median sky is DN4, the99th percentile is DN7 and the maximum is a solitary DN78 spike. Neither the original display nor a declared DN1..16 linear diagnostic stretch shows a closed approximately13.5-pixel Thebe disc. The native raster was decoded independently from its byte layout as well as through the shared decoder. No source silhouette fit was attempted because isolated spikes cannot provide independent body-limb controls.

The [coverage receipt](thebe-candidate-coverage.json) uses the full released Stooke mesh (2,522 vertices/5,040 faces), exact triangle areas, interpolated source vertex normals, the current75° incidence/emission and maximum2.5 photometric-gain limits, full-mesh camera/Sun occlusion, and the current requirement that all four bilinear contributors be valid. Each face has four equal-area quadrature samples; a one-centroid calculation supplies a convergence check. This is a bounded area estimate, not exact global qualification.

| Quantity | Four-sample area estimate |
| --- | ---: |
| Full source-mesh area |27,245.17km² |
| Existing five-frame reliable coverage |20,335.39km² /74.64% |
| Geometrically new area potentially visible in candidate |3,037.24km² /11.15% |
| Additional source-supported area |**0km² /0%** |

Existing accepted coverage changes by only0.068 percentage points between the coarse and finer quadratures. More decisively, the candidate's *entire*800×800 source image contains only66 unmasked pixels and **zero complete2×2 interpolation blocks** after the existing measured-sky subtraction (DN4) and edge-connected0.02 threshold. Therefore its accepted contribution is zero for every possible image translation, independently of the uncertain centre. Changing that threshold to recover isolated low-signal pixels would not establish a resolved target or registration.

Six existing public input files (about4.2MB) were retrieved into temporary comparison storage and matched every existing byte count/SHA-256 before evaluation. All source and recipe pins, sample totals, per-frame results and diagnostic hashes are retained in the receipt. The original five-frame body package, its geometry and prepared assets were not changed. No new preparation or browser result is claimed.
