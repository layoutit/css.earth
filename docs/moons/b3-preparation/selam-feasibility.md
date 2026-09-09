# Selam: source research preserved, scene unqualified

Selam is **not a B3 deliverable scene**. The intake established usable original
Lucy images and a defensible two-lobe size envelope. It did not establish a
registered camera, a mapped surface, an inertial body attitude, or a valid
orbital phase at the application’s 2026 epoch. No object descriptor or registry
entry was added. Six earlier source/model tests passed; these are not body,
browser or B3 delivery qualification.

This document and `selam-feasibility.json` are self-contained. The latter retains
all nine official input URLs, exact byte counts and SHA-256 hashes, reverified
against the local originals on 2026-09-09. No original image is duplicated here.
The source-only work remains in the local directory
`/Users/ekrof/fed/cssEarth-pluto-small-moons/src/planets/selam`; its tests remain
under the corresponding `tests/objects/unit/selam` directory. These local
inventory locations are excluded from the B3 PR. Nothing was moved or deleted,
and this document does not depend on a reader having those files.

## What the sources support

The [Lucy encounter paper, Nature 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11136651/)
(DOI `10.1038/s41586-024-07378-0`, Figure 1 and Methods: Shape) gives these full
lobe axes, with approximately 10% uncertainty per axis:

| Constraint | Inner lobe | Outer lobe |
| --- | --- | --- |
| Parent-radial full axis | 240 m | 280 m |
| Orbital-direction full axis | 200 m | 220 m |
| Spin-pole full axis | 200 m | 210 m |

A local 1,056-triangle construction represents two closed tangent ellipsoids
with these dimensions. It is a constraint envelope, not an archived shape
solution. Point contact is a limiting construction; the shadowed neck width,
depth and detailed surface were not measured. The origin is the envelopes’
center of volume, not an independently measured center of mass. Its SHA-256 is
`ebad2e4bd745fd7be8e8478f22b91b92faaa1017069c8ef7c9fd89e99e56885e`.

The same paper reports a 52.67 ± 0.04 h period and 3.11 ± 0.05 km encounter
separation, supporting the authors’ near-circular, synchronous interpretation.
Those quantities alone do not establish current phase or inertial attitude.
The [pre-encounter Dinkinesh PCK](https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/pck/dinkinesh_v10.tpc)
explicitly identifies its pole coordinates as placeholders. It describes the
parent and cannot supply a measured Selam attitude.

## Original imagery and the remaining camera problem

Two [PDS Lucy L’LORRI partially processed products](https://pdssbn.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/collection.xml)
and their detached XML labels are retained locally. The arrays are 1,024 × 1,024:
primary DN/s, independent error, and unsigned quality flags. They are not
calibrated I/F or natural-color products. Finite primary values with quality
flag zero are eligible, including valid negative values; image brightness does
not define validity. The [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/ik/lcy_lorri_v03.ti)
and [archive SIS](https://pdssbn.astro.umd.edu/holdings/pds4-lucy.llorri%3Adocument-v2.0/llorri_sis.pdf)
are also pinned in the companion receipt.

| Original | Mid-exposure UTC | Range to Dinkinesh | Approximate parent-position discrepancy |
| --- | --- | --- | --- |
| [Near frame, 752129602](https://pdssbn.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/lor_0752129602_03610_00001_1x1_sci_03.fit) | 2023-11-01 16:54:24.459 | 437.23 km | 702.95 px |
| [Departure frame, 752129947](https://pdssbn.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/lor_0752129947_03679_00001_1x1_sci_03.fit) | 2023-11-01 17:00:09.459 | 1,535.39 km | 98.94 px |

The discrepancies compare the WCS projection of the known parent origin with
approximate hand-read image centers. They are diagnostic, not accepted control
points or formal residuals. Stored sample/line centers are zero-based; FITS
CRPIX is converted from one-based, and the archive’s display convention is
bottom-to-top. The full third-order TAN-SIP WCS uses ICRS; source quaternions map
instrument coordinates to J2000. Their boresights agree to floating-point
precision, which checks internal conventions but does not validate pointing.
Exposure timing, acquisition-clock tags and geometric vector units are kept
separate. No arbitrary image flip or timing correction was accepted.

The [DLR photogrammetry description](https://elib.dlr.de/211156/) and
[original LPSC methods paper](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1903.pdf)
provide a concrete route: fit sightlines to Dinkinesh’s silhouette before block
adjustment. Corrected orientations for these exact frames have not yet been
located or derived and independently validated. A provisional parent-recentered
two-view calculation gives about 3.16 km separation and a 5.5 m ray mismatch.
That uses hand-picked centers and unresolved roll, so it is only evidence that
a controlled fitting approach is promising. It is not an accepted orbit state,
attitude or texture registration.

## Executable next steps

1. Acquire the authors’ corrected cameras or fit physically illuminated
   Dinkinesh silhouettes for the exact original frames. Retain fit points,
   image timing, errors and rejected samples.
2. Resolve instrument/sample-line signs against the actual image convention
   and independent source landmarks; do not fix a mismatch by undocumented flips.
3. Fit the published six-axis Selam envelope with its 10% axis uncertainty.
   Validate predicted orientation and lobe silhouettes against a third original
   image excluded from the fit.
4. Prove source quality flags, original pixel sampling, full-model occlusion
   and the actual photographed footprint. Withhold the shadowed neck and unseen
   terrain from photographic coverage.
5. Add and qualify a generic historical/encounter-only scene contract before
   mounting a 2023 encounter. The existing global 2026 geometry must not silently
   receive an old encounter vector. A normal source/preparation/runtime/browser
   qualification would then be required.

The absent current phase and unresolved registration are concrete blockers.
An exact published mesh is not required to make progress: the measured envelope
is sufficient for a controlled source test once camera and scene-epoch contracts
are established.
