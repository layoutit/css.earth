# 67P OSIRIS surface coverage

This follow-up replaces the single-exposure OSIRIS lens with a four-observation
mosaic on the same 1,000 retained RMOC facets. Shape model stays the default.
The photographs span 5 August 2014 19:44:22.918 UTC to 6 August 2014
05:20:22.894 UTC. Preparation owns decoding, camera calibration, quality and
visibility checks, overlap matching and atlas creation.

## Source survey and selected observations

The [MiARD catalog](https://www.miard.eu/homepage/publications/) lists a 144 MB
albedo release. [CORDIS](https://cordis.europa.eu/project/id/686709/results)
describes it as albedo at 625 nm. On 8 September 2026, direct HTTPS requests to
MiARD timed out, its HTTP page returned 503, and the Commission's linked report
attachment returned HDS-010. The original report and data could not be inspected;
coverage, registration and reuse terms therefore remain **unresolved**. This is
an access failure, not evidence that the product is absent or unsuitable.
The DLR textured SHAP7 collection remains a provider-request route.

The public [OSIRIS MTP006 GEO archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/)
contains 273 orange-filter products. A 15-header survey of 5–6 August selected
four complementary views with the same filter and corrected SHAP7 geometry:

| Exposure start (UTC) | Sub-spacecraft longitude | Approximate range |
| --- | ---: | ---: |
| 5 Aug 19:44:22.918 | 134.285° E | 131.4 km |
| 5 Aug 23:44:24.891 | 22.539° E | 122.5 km |
| 6 Aug 02:44:24.890 | 299.203° E | 116.4 km |
| 6 Aug 05:20:22.894 | 227.348° E | 111.5 km |

These metadata values guide source selection; the corrected GEO XYZ/pixel pairs
own the fitted preparation cameras. All four cameras pass the disjoint holdout
check, with maximum residual below 0.0025 source pixel. Each L4 companion must
match every L5 radiance pixel and its observation identity before quality flags
are accepted. The original labels, eight byte/hash pins, dates, credits and
restoration URLs are retained in the package.

## Coverage, compositing and interpretation

The existing limits remain: closest full RMOC surface within 50 m, all four
bilinear GEO contributors within 20 m, incidence/emission at most 80°, disk-law
gain at most 3, and full-mesh camera visibility within 0.5 m. There is no relaxed
geometry threshold, inferred color, backside fill or brightness-based validity
mask. The least foreshortened qualified observation supplies each texel; stable
source order breaks exact ties. A lossless prepared source-index raster records
that choice, with zero for no accepted observation.

Lommel–Seeliger normalization precedes interpolation. One bounded display gain
per observation then reduces overlap brightness steps. Robust median log-ratios
from co-located samples constrain a connected weighted fit; the first exposure
anchors the scale and the common grayscale stretch. Sparse or inconsistent
pairs are withheld from that fit. This display adjustment is not a physical
phase correction or albedo recovery. Photographed shadows and seams can remain.

An early diagnostic sampled 24 stratified points per retained triangle and
weighted accepted points by triangle area. Estimated coverage increased from
16.32% for the original exposure to 56.04% for the four-image union. These are
sampled proportions of the simplified displayed surface, not an exhaustive
measurement of the real nucleus or a count of atlas pixels. The selected
observations do not provide a global photographic map.

## Verification

Final prepared-asset, source-index and matched browser evidence will be recorded
here after the production bake and checks complete. The accepted baseline uses
surface bank SHA-256 `79c63db7373b3d73748ec8d6151b483a0e11da9b2f13f001227e4a7c8bef0b37`.
Six baseline camera views and actual loaded bytes are retained under
`output/comet-intake/67p-coverage/` and `output/playwright/67p-coverage-before-*`.

Image credit: ESA/Rosetta/MPS for OSIRIS Team MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA,
CC BY-SA 4.0. RMOC geometry retains CC BY-SA 3.0 IGO. See the package NOTICE.
