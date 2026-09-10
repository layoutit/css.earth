# Tethys B9 visual review

Accepted for the reviewed regional scientific surfaces, with the limits below.
No blocking source-packing, missing-text, or legend defect was found in the
actual captured views. This is visual acceptance of the specified captures,
not independent proof of absolute VIMS-to-ISS registration or a whole-PR gate.

Reviewed on 2026-09-10 using existing PNGs only. No browser, build, preparation,
or numerical mapping job was launched for this review.

## Exact capture evidence

Worktree: `/Users/ekrof/fed/cssEarth-moons-cassini-atlas`.
Both reports identify capture HEAD `bd265cf3a091c4ef17e9be76dfeb23410364884f`,
Chrome `152.0.7977.84`, and a 1440 × 1000 CSS-pixel viewport.
The report file and response pins define the captured artifacts; HEAD alone
does not identify the then-uncommitted source and prepared files.

| DPR | Report path from repository root | Report SHA256 |
| --- | --- | --- |
| 1 | `output/playwright/b9-surfaces/integrated-2026-09-10T00-40-38.288Z/report.json` | `d983930098d1578e9f58c7a14281b74f9f38b444f253d9c484dd754ec6e3a172` |
| 2 | `output/playwright/b9-surfaces/integrated-2026-09-10T00-41-53.834Z/report.json` | `2b4c83b8c11c1ac8ef49b573d8334c5dec39e11bc2d47645b8d3af7e36217d03` |

Image directories are respectively `tethys-dpr1/` and `tethys-dpr2/` beside
those reports. Reviewed all six `normal`, `infrared`, and `ice-absorption`
`-shadows-{false,true}-scene.png` combinations per directory, their matching
`-details-1.png` captures, and the three `-shadows-true-drag.png` captures.
All 30 image byte counts and SHA256 values match their report entries. Ten of
the twelve detail captures are byte-identical to their scene captures; the two
distinct ice-absorption/shadows-false detail images were inspected separately.

The source comparison is
[source-review/source-maps.png](source-review/source-maps.png), SHA256
`4903958c44ddaddf4bb7d33c20a7b999c6dbe9654fac0c8a43120e7ab5be5e88`.
Its [receipt](source-review/source-maps.json) and both Tethys input raster pins
were checked against the current files. It is a derived numerical-map
diagnostic, not a native camera RGB photograph. Its longitude display is
−180° to +180° east; the mounted thumbnail uses its existing map layout.

## Findings

- **Normal:** the detailed monochrome mosaic remains coherent at both DPRs,
  with intact limb and surface texture in flood and directional lighting. This
  inspection does not claim a pixel-identical pre-B9 browser baseline.
- **Infrared:** the large blue curved swath, separated narrow island and
  intervening scan gaps remain recognizable from the source diagnostic on the
  globe and thumbnail. Gray grid clearly distinguishes unobserved regions.
  Bilinear material sampling and WebP soften narrow RGB edges and gaps; exact
  source-mask-edge parity is not claimed.
- **Ice absorption:** the broad pale green swath, smaller separate patches,
  and internal scan gaps remain distinct. The nearest-sampled scalar pattern
  does not visibly turn gray unsupported regions into continuous science data.
  Different eligible coverage between RGB and absorption is visible in both
  the source panel and mounted thumbnails.
- **Interpretation:** both new controls visibly say “Partial VIMS.” Infrared
  identifies false color, the three wavelengths, partial coverage, retained
  illumination/archive filtering and uncorrected measurements. Absorption
  identifies the near-2.02 µm feature and states the viewing-angle, grain-size,
  noise and filtering limits, uncorrected values, and lack of an ice-abundance
  interpretation. The 2007–2015 dates are visible.
- **Legend and layout:** the absorption palette and 0.55 / 0.65 / 0.75
  band-depth-fraction labels are legible at both DPRs. The unit wraps onto a
  second line without collision. The existing rail scrolls to expose the full
  summary; this hides part of the upper body introduction in the ice captures
  but leaves the selected control, source title, map, legend and interpretation
  visible together. RGB correctly has no scalar legend.
- **Lighting and drag:** the same swaths remain attached after the captured
  drag at both DPRs. Shadows visibly darken the body and expose triangular
  tonal facets, especially on the smooth RGB material. These are a visible
  limitation of this fixed terrain/lighting presentation; the flood-lit RGB
  capture does not show the same facet pattern. Neither lighting state is a
  photometric correction of the archived observations.

## Machine evidence and limits

Each report has 50 loaded object-asset responses, all HTTP 200 and matched to
the recorded local/prepared artifacts, with no recorded case errors. All
twelve before-drag states report the same retained owner, stable retained
state, no app error, and canonical prepared density 2. All six drag records
report stable retained nodes and owner identity. Both context closures and
browser closures completed. These recorded checks do not establish compositor
FPS or general workstation performance.

The reports disclose that the upstream public settings button is hidden and
the capture used its existing hidden-input binding for Shadows. This review
qualifies the resulting lighting states, not public settings reachability.

The [regional framing checks](source-review/tethys/regional-framing-check.json)
provide regional context; they do not turn nearby archive coordinates into
measured landmark registration. The independent
[ISS diagnostic](source-review/tethys/iss-framing.json) is not evidence of a
qualified local absolute alignment. Source-native framing and detector-aperture
eligibility remain the basis of this partial map. Fine absolute placement,
unmeasured gaps, native RGB visual parity, and scientific interpretation as
abundance remain outside this acceptance.

## Final main integration review

Accepted again on 2026-09-10 after integration at capture HEAD
`80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`. These six successful serial
captures supersede the earlier captures for integration acceptance; the source
interpretation and limits above remain unchanged. Each uses the same Chrome
version and 1440 × 1000 CSS-pixel viewport stated above.

All paths below are under `output/playwright/b9-surfaces/`.

| DPR | Lens | Report path | Report SHA256 |
| --- | --- | --- | --- |
| 1 | normal | `integrated-2026-09-10T00-59-56.832Z/report.json` | `cd85361b1070bf12d2b7110e23f32ade8ae23e0e1ded56547eff3a0dca00ac33` |
| 1 | infrared | `integrated-2026-09-10T01-00-17.902Z/report.json` | `5c64a8549371e1c49fe74cd1bee3797fc84bdb433f2bc64a21128a7f65ba9ac1` |
| 1 | ice-absorption | `integrated-2026-09-10T01-00-42.037Z/report.json` | `c90c6162ae2637cb0c80bdbb88c958ee98c831da2c821d16c0039281c25e4433` |
| 2 | normal | `integrated-2026-09-10T01-01-05.892Z/report.json` | `104e050afeae38af8fe4888ac85b2773abdfc57234c13be9ee5dedfb08016e0f` |
| 2 | infrared | `integrated-2026-09-10T01-01-27.062Z/report.json` | `e977f57cf43a3db22dc5f1a493f6964228e5fc5392915e7c8701559e501bbe0f` |
| 2 | ice-absorption | `integrated-2026-09-10T01-01-52.539Z/report.json` | `f5a8f77b8af7b03f4b883925368c27dc844bc6d22df2226f74c7b809f3922dee` |

For each row the exact image directory is `tethys-dpr<DPR>/` beside its report,
with the selected lens prefix followed by `-shadows-{false,true}-scene.png`,
`-shadows-{false,true}-details-1.png`, and `-shadows-true-drag.png`. All 30 PNG
byte counts and SHA256 pins were verified. The twelve scene images, six drag
images and two distinct ice/shadows-false detail images were visually reviewed;
the other ten detail images are byte-identical to their scene images.

The current views preserve the accepted monochrome surface, curved blue RGB
swath, separate islands, and pale-green absorption regions with gray scan gaps.
Both DPRs retain readable dates, wavelengths, partial-coverage and uncorrected
measurement caveats, and the 0.55 / 0.65 / 0.75 fraction legend. The fuller
celestial context and v0.436/432-object interface are visible, without a new
surface or text defect. The same directional-lighting facets remain visible on
the smooth RGB surface; drag keeps the mapped regions attached. No new blocker
was found against the earlier accepted captures or the pinned source panel.

All loaded `public/scenes/tethys/` response hashes equal their historical
accepted counterparts. The normal runs contain 16 object-asset responses each;
the infrared and absorption runs contain 17 each, all HTTP 200 and matched.
The twelve before-drag states retain the same owner and nodes, prepared density
2 and no app error. All six drags are stable; all six case error arrays are
empty and all context/browser closures completed. The six corresponding
`output/b3-resume/b9-main-tethys-<lens>-qualified-dpr<DPR>.json` monitors report
PASS. This is acceptance of the pinned final captures, without extending the
absolute-registration, native-RGB-parity, settings-reachability or performance
claims above.
