# 67P OSIRIS surface coverage

This records the initial four-image August mosaic. [Surface imagery](SURFACE-IMAGERY.md) documents the later September additions and current coverage.

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

[The evidence record](evidence/osiris-coverage.json) binds source restoration,
prepared hashes, camera calibration, overlap gains, source-index counts and
browser readbacks. [Six matched views](evidence/osiris-coverage-comparison.png)
show the previous image bank, the mosaic, and absolute RGB differences. Each
pair uses the same production renderer, camera matrix, geometry, viewport and
DPR; the original bank was restored from its content-addressed public URL.
Both image hashes are checked before every capture. This is an atlas comparison,
not a native-renderer parity claim.

The final atlas accepts 1,016,054 of 1,782,240 triangle-interior texels (57.01%).
This differs from the 56.04% area estimate because atlas texels weight each face's
raster layout rather than its physical area. The four selected-source counts
are 250,119, 266,512, 308,502 and 190,921 in chronological order. Display gains
are 1.0000, 1.0190, 1.0807 and 1.1630. The separate 348,217-byte source-index
JSON decodes losslessly to 4,128,768 one-byte codes, including atlas bleed.
Geometry and the default model banks remain byte-for-byte unchanged.

On the 176-object mosaic snapshot, source verification and the full production
build passed. `NODE_OPTIONS=--max-old-space-size=8192 pnpm test` passed package,
renderer, all 1,430 platform and all 234 shell tests. The initial unmodified
command exhausted Node's default 4 GiB heap in two registry-wide audits; no
assertion or tolerance was changed. All 352 object/DPR DOM cases, both six-hop
navigation sequences, and all 13 67P conformance cases passed. Conformance used
the development server because its harness requires development diagnostics;
the DOM sweep and the dedicated retained-mosaic captures used the production
build. The source/mosaic checks also cover valid darkness, disconnected overlap
fits, excessive gains, source identity and the lossless provenance raster.

Main then added Kiviuq and Albiorix in `554c9811`. The merge regenerated 67P's
shared marker binding through official preparation. The other compiled
transports were serialized only when their bytes matched the checked-in hashes;
all 178 passed. Final integration passed global source verification, package
tests, 34 focused source/geometry/marker tests, runtime ownership and leaf-layout
checks for 67P and both moons, and a production build using those verified
transports. Six production object/DPR cases passed for the three affected
objects. The final 67P capture again proves 1,000 retained facets, unchanged
geometry, identical high-density image banks at DPR 1 and 2, both lighting
states, no runtime errors and no requests during the drag.

The full aggregate suites were not repeated after the two-object registry
expansion; the preceding full passes and final focused integration checks are
recorded separately. The six newly required source files passed fresh public
restoration. All three changed runtime assets were published, and all 34 67P
inventory files passed a clean public installation with byte/hash verification.

Image credit: ESA/Rosetta/MPS for OSIRIS Team MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA,
CC BY-SA 4.0. RMOC geometry retains CC BY-SA 3.0 IGO. See the package NOTICE.
