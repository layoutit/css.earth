# Itokawa

Itokawa is shown on the Gaskell shape model with a partial, controlled AMICA photographic mosaic and an Elevation view. Unobserved terrain remains a grid.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| AMICA mosaic | Ten v-band observations from September–October 2005, with [Gaskell-controlled AMICA records](https://data.darts.isas.jaxa.jp/pub/pds3/hay-a-amica-3-amicageom-v1.0/), original FITS and preflight flat. The October close-ups take priority over distant September images where their qualified coverage overlaps. Relative detector brightness, not absolute radiance or albedo. |
| Shape and Elevation | [Gaskell ver128q](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-itokawa.shape-model/data/vertex/ver128q.tab), derived from 775 AMICA images. Elevation is source radius minus 165 m; the original black-rock prime meridian is retained. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/ITOKAWA/target) Itokawa centre-point export, snapshot 2026-09-11, public domain. Labels appear at the closest zoom only, and a selected feature stays labelled. |
| Mission facts | [NASA Itokawa facts](https://science.nasa.gov/solar-system/asteroids/25143-itokawa/). Pole and spin follow `source/reference/bundle_description.txt`. |

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The shared preparer scales the source shape by the 0.165 km radius and simplifies it with meshoptimizer 1.2.0 to 794 faces, with 4.512 m estimated error. The result has one connected component and Euler characteristic two. Elevation is radial height above the 165 m sphere, taken from the nearest point on the full source surface within 6 m; samples beyond that bound are withheld with the shared gray grid.

The AMICA frames use the original Gaskell-controlled DDR Cartesian backplanes. Preparation verifies every DDR image sample against the vertically reversed original FITS array, then applies the preflight flat and exposure normalization. Clipped 255 values and defective flat pixels are withheld. A bounded Lommel–Seeliger disk correction follows the AMICA use described by Li, Le Corre and Reddy, LPSC 2018 abstract 1957; incidence and emission are limited to 70 degrees and gain to 1.5. Frame `2481672682` sets the brightness reference; the other frames follow in increasing median pixel footprint.

## Evidence

- **Coverage.** At 24 area-weighted samples per retained triangle, coverage is 84.26%. Distant September images now supply 5.36% of the display mesh, down from 36.58%. These estimates describe the display mesh, not exact photographed area.
- **Cameras.** Disjoint camera holdouts reach maximum residuals of a few hundred-thousandths of a pixel. Sampled source-mesh distances stay below the 5 m contributor limit (1.711 and 1.555 m for the two newest frames). These check consistency with the archive, not absolute navigation accuracy.
- **SBMT oracle.** The [shared SBMT oracle](../../../packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/README.md) reads the full shape, the ST_2402987304 image and its [archived SUM pointing](source/observations/N2402987304.SUM). Pointing, sampled values and surface intersections agree with the repository's code. UV projection differs by up to 1.0021 pixels, consistent with SBMT's angular UV approximation; it is not a measured ground-truth error. The [fixture](../../../packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.json) records the inputs.
- **Reader oracle.** [`amica-ddr.py`](../../../packages/bake/src/objects/layers/terrestrial/missions/amica-ddr.py) reads the DDR cube, detector FITS and flat independently, and [`amica-geo.oracle.test.mts`](../../../packages/bake/src/objects/layers/terrestrial/missions/amica-geo.oracle.test.mts) requires the planes to match.
- **Excluded frames.** Paired-exposure candidates `2495806075` and `2506694595` exceeded the overlap-gain bound. Single-exposure and 16-bit subwindow products remain outside the qualified reader.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `amica` | 10 | 0 | — | — | — | its other 10 frames | 0 of 10 | — | 1 of 10 | — | ×1.13 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Coverage is partial; the grid marks unavailable terrain. The lossy detector images lack a per-pixel quality plane. Disk normalization is approximate and does not restore stray light, temporal flat changes or shadowed terrain. Photographed shadows and residual seams remain. Fine triangle-edge artifacts show in smooth areas, particularly in Elevation; they are a rendering limitation, not terrain. Named-feature outlines are not published nomenclature boundaries.
