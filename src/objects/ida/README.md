# Ida

The asteroid 243 Ida on the Thomas shape model, with Galileo's processed monochrome mosaic, two calibrated
green-filter reflectance frames, a three-filter false-colour view and an elevation map.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| SSI reflectance | Galileo green-filter [0202561278](source/observations/0202561278rcal_gre.xml) and [0202560500](source/observations/0202560500rcal_gre.xml), 28 August 1993, 111–170 m/pixel. I/F normalized to 25° incidence and phase with a published Hapke model; fixed display stretch, no fitted gain. |
| Monochrome and shape | [Thomas PDS release](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/), [Thomas et al. 1996](https://doi.org/10.1006/icar.1996.0033). The processed mosaic has broader coverage and finer contributing imagery than the I/F pair. |
| SSI false colour | One Galileo pointing on 28 August 1993: [0202561352](source/observations/0202561352rcal_ir8.xml) 0.89 µm as red, [0202561278](source/observations/0202561278rcal_gre.xml) green as green and [0202561313](source/observations/0202561313rcal_vio.xml) violet as blue, the three exposures within 43 seconds. Calibrated I/F with the original illumination, displayed 0–0.11 in every filter; no albedo recovery and no fitted gain. |
| Elevation | Shape radius minus 16 km, false color from −13 to +16 km; not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/IDA/target) Ida centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

The photometric model is the Hapke fit of [Helfenstein et al. (1996)](https://doi.org/10.1006/icar.1996.0036),
transcribed in [the model record](source/photometry/helfenstein-1996-hapke.json). The rotation uses the pinned Galileo
[`pck00007.tpc`](https://naif.jpl.nasa.gov/pub/naif/GLL/kernels/pck/pck00007.tpc) to resolve a sign the shape label
loses. Two labelled names carry a caption note from their English Wikipedia article (CC BY-SA 4.0), recorded in
`source/features/notes.json`.

## Processing

**Shape.** `243ida.tab` gives 16,471 latitude/longitude/radius records on a 2° grid from Galileo stereogrammetry and
limb matching. Radii span 3.2963–31.0466 km. Meshoptimizer 1.2.0 simplifies it to 800 triangles, one closed
component. Against 3,200 equal-area samples the mean and maximum deviations are 130.984 and 829.461 m.

**Monochrome.** `243idam.fit` is a 2520×1260 simple-cylindrical mosaic: high-pass detailed Galileo frames over a
low-pass coarse background, best sampling about 25 m/pixel. It is a processed observation, not albedo or natural
colour. Exactly zero marks the 2.3975% of pixels that could not be projected, drawn as the gray grid. The PDS4 label
says bottom-to-top, but Stooke's north-up crater positions show that a flip would invert the map, so rows are read
north to south. On a detailed crop the Stooke map correlates 0.283 with the unflipped mosaic and −0.003 flipped.

**SSI reflectance.** Galileo brightness is normalized to 25° incidence, 0° emission and 25° phase with the
Helfenstein et al. Hapke model: single-scattering albedo 0.22, asymmetry −0.33, shadow-hiding amplitude 1.5 and width
0.020, roughness 18°. The cameras come from the Thomas image catalog and the SSI instrument kernel, with no local
fitting or warping. Bad data is withheld from the original detector files and `idabad.tab`, not by a brightness
threshold. Projection keeps incidence and emission under 65° with a five-pixel inset at detector edges. The second
frame's overlap gain is 0.994. The display range is 0–0.0931 I/F, the 99.5th percentile, shown linearly. Where frames
overlap, the finer one wins.

**False colour.** Three archived frames are composed through their catalog cameras with nothing refitted. The 0.89 µm
frame was chosen over the 0.76 µm one because it has fewer dropped scan lines.

**Orientation.** The pole is RA 348.76° ±7.5°, Dec +87.10° ±0.4°, with a retrograde period of 0.1930680 days, and
`W = 265.95° − 1864.6280070° d` at JD 2451545.0. `source/preparation/rotation.json` records the choice of +87.10° over
the kernel's +87.12°. Horizons gives radius 16 km and GM 0.00275 km³/s².

**Features.** Each gazetteer centre is cast through the prepared hit mesh, so anchors sit on the shape model. Craters
and faculae trace a rim circle, other types their published extent box. Outlines are not published boundaries.

## Evidence

- Frame 0202561278 was checked against the Thomas mosaic on four withheld 32×32 patches: every correlation exceeds 0.7,
  RMS residual 2.236068 source pixels, maximum 3.605552, under the four-pixel limit (about 444 m). Frame 0202560500
  gives 1.414 px RMS and 2.236 px maximum. The mosaic shares mission observations, so these are not independent
  cartography. Results are in `source/reference/calibrated-registration*.json`; reproduce with
  `python packages/bake/cli/verify-catalog-camera.py src/objects/ida/source OUTPUT_DIRECTORY`.
- False-colour band alignment against the green frame: violet lands at 0.37 px RMS over 17 held-out patches, worst
  0.58 px; 0.89 µm at 0.71 px RMS, worst 1.01 px. The composed dataset covers 17.2% of the surface.
- The colour separation is mild: on the minimap, red minus blue over covered pixels runs from −11 to 46 of 255 with a
  median of 0. That is what these three filters record on Ida, not a display fault.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `calibrated` | 2 | 2 | 4.74° | 2.12° | 4.24° | its other 2 frames | 1 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The Thomas mosaic is processed monochrome, with photographed shadows, local stretches and seams. Its exactly-zero
  gaps remain a grid.
- Elevation is radius minus 16 km and includes Ida's irregular shape. It is not gravitational height.
- Green images 0202558300 and 0202559400, and clear-filter images 0202561700, 0202561745, 0202561800, 0202561945,
  0202562300 and 0202562339, failed the registration checks and are excluded. For example, 0202562300 correlated at
  0.949 but was displaced by (4, 2) pixels. Finer source pixels alone do not qualify a projection.
- The 0.89 µm frame keeps the dropped scan lines the archive left in it.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
