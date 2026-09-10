# Iapetus B9 visual review

Accepted for the partial scientific surfaces shown in the specified successful
captures. No blocking source-packing, boundary, legend or text defect was found.
This acceptance does not establish native RGB parity, absolute image
registration, photometric correction, or whole-PR readiness.

Reviewed on 2026-09-10 using retained images and reports only. No browser,
numeric job, build or test was run during this review.

## Exact evidence

Worktree: `/Users/ekrof/fed/cssEarth-moons-cassini-atlas`.
Reports identify capture HEAD `bd265cf3a091c4ef17e9be76dfeb23410364884f`,
Chrome `152.0.7977.84`, and a 1440 × 1000 CSS-pixel viewport. Their artifact
pins identify the captured state, including the then-uncommitted body changes.

All report paths below are under `output/playwright/b9-surfaces/` from the
repository root:

| DPR / lenses | Report | SHA256 |
| --- | --- | --- |
| 1 / normal, infrared, ice absorption | `integrated-2026-09-10T00-43-15.796Z/report.json` | `1c78a4d2a122e441a86ae7cb779e7f13eafff652ea20fa9157024fc95a7a1ef7` |
| 2 / normal | `integrated-2026-09-10T00-45-37.066Z/report.json` | `c6e0982f8e5db18a84e0c47a20fc99f96a0830a006bd4e1a0314d5f7e0f50ad9` |
| 2 / infrared | `integrated-2026-09-10T00-45-54.203Z/report.json` | `b970d786c3d412106a765dfbb114b7468ddfdd250884182278c9d85fdb1a0200` |
| 2 / ice absorption | `integrated-2026-09-10T00-46-15.354Z/report.json` | `c6f9ea3b42d706e1eb6742853080e29bed7b535434ccc405ffb49ddd621aa440` |

Images are in `iapetus-dpr1/` or `iapetus-dpr2/` beside each report. For every
listed lens, both `-shadows-false-scene.png` and `-shadows-true-scene.png`, their
matching `-details-1.png` captures, and `-shadows-true-drag.png` were reviewed.
Lens filename prefixes are `normal`, `infrared`, and `ice-absorption`.
All 30 PNG byte counts and SHA256s match their report entries. Each of the
twelve detail captures is byte-identical to its corresponding scene capture.

The derived source reference is
[source-review/source-maps.png](source-review/source-maps.png), SHA256
`4903958c44ddaddf4bb7d33c20a7b999c6dbe9654fac0c8a43120e7ab5be5e88`.
Its [receipt](source-review/source-maps.json) matches the image and both current
Iapetus inputs: RGB display SHA256
`a3788744172cac6820eaaf39e53d1013ce65612799c107e96a17fbebbcea2e7f`
and ice absorption SHA256
`399a434937605b2d3215a3691fb630435b4957ff8b5eb23334b42bf42f440fdc`.
The diagnostic displays −180° to +180° east, placing the Iapetus region across
the map boundary. Its split at that boundary is consistent with the contiguous
region shown by the mounted globe and the existing thumbnail layout.

## Findings

- **Normal:** the original monochrome terrain, including the conspicuously
  coarser lower/polar imagery, remains coherent at both DPRs. The visible
  description correctly discloses coarse polar detail, photographed shadows
  and seams. No pre-B9 pixel-baseline equivalence is asserted.
- **Infrared:** the blue field and its gray-brown measured transition on the
  right agree in broad spatial pattern with the derived source panel and
  thumbnail. Measured dark terrain remains displayed rather than being
  replaced wholesale by the gray no-data grid. The jagged scan perimeter,
  narrow internal gaps and varying native sampling remain visible. Bilinear
  sampling/WebP soften RGB edges; exact mask-edge parity is not claimed.
- **Ice absorption:** the pale yellow-green field, blue transition and deep
  blue region retain the same broad pattern as the source diagnostic. The
  small brighter islands within the blue region are visible at both DPRs.
  Coarse blocks and fine scan gaps remain explicit, with unsupported outer
  regions shown as a gray grid rather than extrapolated measurements.
- **Scientific text and legend:** both controls visibly say “Partial VIMS.”
  Source titles show 10 September 2007. Infrared names false color and the
  three wavelengths, partial coverage, retained illumination/filtering and
  uncorrected values. Ice absorption identifies the near-2.02 µm feature,
  viewing-angle, grain-size, noise and filtering limits, uncorrected values,
  and the lack of an ice-abundance interpretation. The 0 / 0.4 / 0.8
  band-depth-fraction legend is legible; its two-line unit has no collision.
  All of this fits beside the body at both DPRs without scrolling the title
  or selected control out of the captured view. RGB has no scalar legend.
- **Lighting and drag:** directional Shadows darken most of the selected
  hemisphere; the illuminated edge still shows the measured transition and
  gray no-data border. Flood lighting exposes the full sampled region.
  Surface patterns remain attached after the captured drags at both DPRs.
  Neither lighting state removes the archive's original illumination or
  makes the map a corrected albedo product.

## Recorded checks and limits

The DPR1 report records 37 loaded object-asset responses; the DPR2 normal,
infrared and ice reports record 11, 13 and 13 respectively. All are HTTP 200
and match their recorded local/prepared artifacts. All four cases have no
recorded errors and complete context/browser closures. All twelve pre-drag
states report stable retained state, the same owner, no app error and canonical
prepared density 2. All six drags report retained stability and owner identity.
These checks do not establish compositor FPS or general workstation safety.

The reports disclose use of the existing hidden-input binding for Shadows,
because the upstream public settings button is hidden. This review accepts the
captured lighting states, not public settings reachability. DPR2 was reviewed
as three successful isolated lens captures; it is not a claim that a single
combined DPR2 run succeeded.

The source panel is a numerical raster diagnostic, not an independent native
camera RGB image. Visual consistency cannot establish subpixel pointing,
absolute geographic registration or chemistry abundance. The native aperture,
navigation, detector-quality and numerical-map qualifications remain separate
evidence owned by the source pipeline.

## Final main integration review

Accepted again on 2026-09-10 after integration at capture HEAD
`80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`. These six successful serial
captures supersede the earlier captures for integration acceptance. The source
interpretation and limits above remain unchanged. They use Chrome
`152.0.7977.84` and a 1440 × 1000 CSS-pixel viewport.

All paths below are under `output/playwright/b9-surfaces/`.

| DPR | Lens | Report path | Report SHA256 |
| --- | --- | --- | --- |
| 1 | normal | `integrated-2026-09-10T01-02-17.494Z/report.json` | `6f2f9d831a022c407ae69e1189737e11e7dd538f5112678f6b0f0b0b6e6b3aaa` |
| 1 | infrared | `integrated-2026-09-10T01-02-33.411Z/report.json` | `6453bf570ebd36c5eda3b0e30c373e64724bb9130b97e2cc4a7badd912a35ced` |
| 1 | ice-absorption | `integrated-2026-09-10T01-02-54.313Z/report.json` | `e8d7062ab88d6bc8d1f7caeacfe4c0e519e228d9d023801412fe4e9d2d223e60` |
| 2 | normal | `integrated-2026-09-10T01-03-14.546Z/report.json` | `85ab958bc923cad16aae524ec0f9ca5f21c630f1b5a854e14bcae79439a79512` |
| 2 | infrared | `integrated-2026-09-10T01-03-31.705Z/report.json` | `fd2f9b82851abb7c5a83dd714c683657e8482609211e4d96132ee80812b05526` |
| 2 | ice-absorption | `integrated-2026-09-10T01-03-52.454Z/report.json` | `594f9d5bf14a0107f391093183f9912ed118cf63561af4a3c4ab43a65b2618ab` |

For each row the exact image directory is `iapetus-dpr<DPR>/` beside its report,
with the selected lens prefix followed by `-shadows-{false,true}-scene.png`,
`-shadows-{false,true}-details-1.png`, and `-shadows-true-drag.png`. All 30 PNG
byte counts and SHA256 pins were verified. The twelve scene images and six drag
images were visually inspected; all twelve detail captures are byte-identical
to their corresponding scene captures.

The current normal image preserves the detailed monochrome terrain and the
disclosed coarse polar region. RGB preserves the blue field and brown-gray
measured transition, including the darker source samples. Absorption preserves
the pale-green field, blue transition and small bright islands in that
transition. Fine gray exclusions and the unsupported outer grid remain visible.
The patterns match the earlier accepted captures and the pinned numerical
source panel, including the longitude-wrap region. Both DPRs show complete
source dates, wavelength/false-color explanation, partial and uncorrected
measurement caveats, and the 0 / 0.4 / 0.8 band-depth-fraction legend without
collision. Shadows and drag preserve attachment; source illumination is still
present in the measurements. The v0.436/432-object context adds no new surface,
legend or text defect in the reviewed views. No new blocker was found.

All loaded `public/scenes/iapetus/` response hashes equal their historical
accepted counterparts. The normal runs contain 11 object-asset responses each;
the new-lens runs contain 13 each. All are HTTP 200 and matched. All twelve
before-drag states retain owner identity and stable nodes, prepared density 2,
and no app error. All six drags retain their nodes and owner and report stable;
all six case error arrays are empty and context/browser closures completed.
The six `output/b3-resume/b9-main-iapetus-<lens>-qualified-dpr<DPR>.json`
monitors report PASS. This final evidence consists of isolated lens runs at
both DPRs. The source-registration, native-image-parity, settings-reachability
and performance limits stated above still apply.
