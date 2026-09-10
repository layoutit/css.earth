# Phoebe fixed-mesh source-map review

The final 1,440 × 720 source map passes the independent checks below. This qualifies the
published nominal regional source mapping; it does not improve the measured
absolute registration uncertainty or establish continuous exposure/PSF support.
The renderer, camera, and existing 3,500-face terrain are unchanged.

The reproducible audit is [qualify-phoebe-fixed-map.py](qualify-phoebe-fixed-map.py);
its exact input/output hashes and measured results are in
[phoebe-fixed-map-1440-qualification.json](phoebe-fixed-map-1440-qualification.json).
The earlier 720 × 360 result is retained separately in
[phoebe-fixed-map-qualification.json](phoebe-fixed-map-qualification.json).
The final grid matches the existing atlas's 16 latitude bands; this change adds
no native observation detail and does not change geometry or source support.
The reviewed mapper SHA256 is
`47588d2471bcd76c895847ce8c549736cfe459ca21f3511c364de816a316faf1`.
The recipe SHA256 is
`68162ebf0bc13325bf7d9ae295cf34903c1f100f3b13a7d35bd5d7db11689647`.

## Closed geometry and geographic ambiguity

The terrain hash is
`a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178`.
At the unchanged `106.5 / 230` kilometre scale, exact coordinate matching finds
1,752 vertices, 5,250 edges and 3,500 faces. Every edge has two oppositely
directed incidences, every vertex link is one closed cycle, and all faces are
connected. The Euler characteristic is 2, signed volume is positive
(5,084,230.85486488 km³), and the origin solid-angle winding number is
1.0000000000000002. No coordinate welding tolerance was used.

For a planar facet, the radial crossing sign is the sign of its outward normal
dotted with its centroid. A closed consistently oriented surface enclosing the
origin cannot have additional outward radial crossings without an inward
crossing. This supports withholding rays that hit the one inward radial facet.
The independent plane-intersection and Gram-barycentric oracle finds four such
grid cells, at zero-based row/column pairs (326, 1287), (331, 1285),
(333, 1284), and (340, 1281) in the actual final TIFF frame.
All are unowned and nodata in both products.

More directly, **every one of the 13,325 published radial directions was tested
against all 3,500 faces** using that independent oracle, without the production
BVH or Möller–Trumbore formula. Each has exactly one distinct geometric hit.
The closest face always agrees with the production helper; maximum distance
difference is 8.53 × 10⁻¹⁴ km. The oracle merges coincident shared-boundary hits
only within 128 float64 epsilons scaled by distance. These checks do not claim a
general mesh self-intersection theorem, but directly close ambiguous geographic
painting for all actual published cells.

The production mapper now tests the full 1,440 × 720 grid against the first
aperture cone; it has no estimated corner bounding box that could silently omit
valid support.

## Original values and ownership

Both infrared RGB and water-band depth contain 13,325 owned cells and use all
41 accepted pixels from observation `1465671822_1`. Every owner identifies that
observation; every one-based source-pixel ID lies inside its pinned qualified
native mask. The owner and source-pixel missing masks agree, all 1,023,475 missing
cells remain the declared TIFF nodata, and all owned values are finite and
distinct from nodata.

The audit decodes the selected original calibrated float32 planes directly with
stdlib byte offsets. RGB channels 70/44/25 match the recorded source pixel
bit for bit. The water-band index is recomputed independently as
`1 - R70 / ((1-w) R58 + w R81)`, with `w` derived from the exact published decimal
wavelengths, then rounded to float32. All output values match bit for bit.
There is no averaging, source-value interpolation, or spectral-value selection
in these tests. These are the existing calibrated/filtered source values, not
unprocessed detector measurements or quantitative ice abundance.

The mapper's source-anchor checks also bind the fitted recipe to every recorded
accepted pixel's exposure time, observer position, unit ray and terrain hit.
The regional fit receipt, source cubes, source-frame rotation, origin estimate,
navigation helper and terrain remain hash-bound. This prevents internally
consistent mapping under an accidentally changed recipe frame.

## Exposure and physical support

For every contributing source pixel, the audit selects up to four actual output
points: worst coarse angular margin, worst coarse incidence/emission margin,
and first/last raster positions. Deduplication leaves 154 points. Each was
checked at 129 exposure fractions, giving **19,866 point-pose checks**, compared
with the mapper's nine fractions. The audit independently inverts the source
look angles rather than reusing the mapper's cone-containment test.

There were zero nominal-aperture, incidence/emission, foreground-occlusion or
self-shadow failures. The minimum physical-aperture margin was
1.00164 × 10⁻⁶ rad, minimum incidence/emission cosine margin over the 60° limit
was 0.00232439, and maximum closest-visible endpoint disagreement was
3.21 × 10⁻¹¹ km. The shadow check uses the mapper's explicit 0.1 mm outward
numerical origin offset; it is not a change to the terrain.

This is dense sampled evidence for the stated nominal HI-RES aperture and
1 × 10⁻⁶ rad inset. It does not bound unsampled temporal extrema, PSF support,
uncertain absolute pointing or the regional registration fit. The audit uses
the previously source-qualified camera interpolation and independently tested
fixed-mesh primitive for the dense ray checks.

## Scope and resources

The audit completed in 2.47 seconds with 450,330,624 bytes peak RSS on macOS
(about 429.5 MiB), using one numerical thread. It did not regenerate terrain,
run a browser, bake assets, or alter the trial maps. Display conversion and
integrated renderer/UI evidence are separate gates. The mapped region remains
the accepted 41-pixel observation; the separately rejected `1465670650_1` fit
is not part of this qualification.

Reproduce the final audit from the repository root with the scientific Python
environment, one BLAS/OMP thread, and this command:

```sh
python3 docs/moons/b9-cassini-ice-surfaces/source-review/iapetus/qualify-phoebe-fixed-map.py \
  --recipe src/planets/phoebe/source/cassini-ice/prepare.json \
  --output docs/moons/b9-cassini-ice-surfaces/source-review/iapetus/phoebe-fixed-map-1440-qualification.json
```

The final audit resolves all source and registration inputs from the packaged
recipe. It does not require the ignored trial directory.
