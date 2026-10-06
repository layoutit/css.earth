# Steins

This package presents asteroid 2867 Šteins with the published Rosetta OSIRIS
shape, a two-image OSIRIS photograph, the Stooke photographic map, and
shape-derived Elevation.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| OSIRIS reflectance | WAC OI-filter `W20080905T183606461ID4DF17` and `W20080905T183630497ID4DF17`, 5 September 2008 at 18:36:22.008 and 18:36:46.044 UTC; 129/113 m per pixel. Acquisition illumination retained, with 1.29646 relative display gain. |
| Monochrome | [Stooke V3 map](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html), a processed photographic visualization with broader coverage; not natural color or albedo. |
| Shape and Elevation | [Jorda et al. PDS 2013 shape](https://pdssbn.astro.umd.edu/holdings/ro-a-osinac_osiwac-5-steins-shape-v1.0/dataset.shtml). Elevation is radius minus 2.58 km, false color over −0.7 to +1.1 km; not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/STEINS/target) Steins centre-point export, public domain. Labels appear at the closest zoom only. |

The OSIRIS cameras come from the ROS_V33, OSIRIS V15 and Steins V05 kernels.
The pinned IAU PCK00011 pole is RA 91°, DEC −62°, W 321.76 + 1428.09917d at J2000.

## Processing

The shape is simplified with meshoptimizer 1.2.0 to 356 faces, one closed
component. A 3,200 equal-area ray comparison against the source gives mean
11.6846 m and maximum 53.8148 m.

Each OSIRIS image has its own pinned camera profile.
`python packages/bake/cli/prepare-archived-camera.py src/objects/steins/source`
reproduces a camera, after
`node packages/bake/cli/restore-source-inputs.mts --object=steins` restores its
kernels. Quality flags, sigma, and 70° incidence and emission limits decide
which pixels count. Lowest emission selects the source where the images overlap.
Both images keep acquisition illumination, levelled by one relative gain of
1.29646. The atlas samples each original grid directly with a 2 × 2 texel
footprint ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)).

Named features are cast through the prepared hit mesh so every anchor sits on
the shape model. Craters and faculae trace a rim circle, other types their
published extent box.

## Evidence

- The released camera frame reproduces each image's independent archived RA/Dec to 0.000004 degrees.
- The source/model footprint diagnostic gives a 95th-percentile limb distance of 2.83 and 3.0 source pixels. It includes optical blur and shape differences and is not absolute registration accuracy.
- A reader oracle, [`osiris-reflectance.py`](../../../packages/bake/src/objects/layers/terrestrial/missions/osiris-reflectance.py), reads the WAC product with pvl and numpy, and [`archived-camera.oracle.test.mts`](../../../packages/bake/src/objects/layers/terrestrial/missions/archived-camera.oracle.test.mts) requires the decoder to reproduce 48 sampled I/F values exactly.
- [Registration and coverage](source/reference/registration.md) gives the coordinate proofs and mask interpretation.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 2 | 2 | 4.30° | 4.95° | 0.00° | its other 2 frames | 0 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Faithfulness status:** the OSIRIS photographic dataset is deferred. Neither image has a surface-intercept anchor or fitted image-to-shape registration. The Stooke Monochrome map has its own published control; it does not promote the OSIRIS frames to a registered surface.
- The two photographs span only tens of original pixels and keep gaps as a grid. Enlarging the atlas does not add measured detail.
- The 18:37:16 candidate needed a 1.56 gain, above the 1.35 limit; later frames had poorer footprint agreement and are excluded. No global albedo is inferred.
- Rosetta imaged about 60% of the body; unseen terrain comes from lightcurve inversion and is less certain. PDS reports roughly 20 m mean control-point error over illuminated regions; that is not global accuracy.
- **The published shape contains an artificial elevation jump where SPC terrain meets lightcurve-derived terrain.** It is kept and labelled rather than smoothed.
- The app's reference radius is the pinned Horizons 2.58 km; the source reports a volume-equivalent radius of 2.63±0.2 km. The source vertices are not rescaled.
- Named feature outlines are not published nomenclature boundaries.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="steins-source-record"></a>
<a id="selected-data-and-bounded-survey"></a>
<a id="geometry-and-accuracy"></a>
<a id="appearance-and-processing"></a>
<a id="reproduction"></a>
<a id="near-opposition-osiris-observation-2026-09-08-source-record"></a>
<a id="reproduction-and-source-closure"></a>
<a id="spacecraft-mosaic-update-2026-09-09"></a>
