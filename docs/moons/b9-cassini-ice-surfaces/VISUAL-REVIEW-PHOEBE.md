# Phoebe B9 visual review

Accepted for the coarse regional scientific materials in the six successful
captures below. No blocking source-packing, boundary, legend or interpretation
defect was found. The initial evidence was captured on the `bd265cf` base.
The later `80e19c5` integration and its enlarged shared context have their own
accepted captures in the final main integration review at the end of this doc.

Reviewed on 2026-09-10 using retained PNGs and reports only. No browser,
numerical mapping, build or test job was run for this review.

## Exact evidence

Worktree: `/Users/ekrof/fed/cssEarth-moons-cassini-atlas`.
All reports record HEAD `bd265cf3a091c4ef17e9be76dfeb23410364884f`, Chrome
`152.0.7977.84`, and a 1440 × 1000 CSS-pixel viewport. File/response pins,
rather than HEAD alone, identify the then-uncommitted body material state.
The successful report paths were recovered from
`output/b3-resume/b9-phoebe-{normal,infrared,ice-absorption}-qualified-dpr{1,2}.log`.

All paths in this table are beneath `output/playwright/b9-surfaces/`:

| DPR / lens | Report | SHA256 |
| --- | --- | --- |
| 1 / normal | `integrated-2026-09-10T00-51-15.329Z/report.json` | `308258aa0ff1fd1930b19d3d22fe710ca1ff500480c3caab33b8b225b5af5c10` |
| 1 / infrared | `integrated-2026-09-10T00-51-33.466Z/report.json` | `d5e226565f55e5c2fb761e2fbbcd51ef3d5e081f9a709b7ce11d5d62aef1b3dc` |
| 1 / ice absorption | `integrated-2026-09-10T00-51-56.528Z/report.json` | `fa17e99d502b92c5ef042837e23d473aad35a30ca1eb3e537ff9046a9d36cd6c` |
| 2 / normal | `integrated-2026-09-10T00-52-18.217Z/report.json` | `077812f6695a64015fc575dbf72eac6e96c72cd35db8f999b2dcddc6f6f6f832` |
| 2 / infrared | `integrated-2026-09-10T00-52-36.898Z/report.json` | `311af74515a07a3330f95e88cf34590f1ad7b1f093ca88edb80847c2b5165362` |
| 2 / ice absorption | `integrated-2026-09-10T00-53-00.769Z/report.json` | `90634ea4925cef7d5a3c6493d858be75df71f42a68d124940674f222c10132ac` |

Each report's PNGs are in its `phoebe-dpr1/` or `phoebe-dpr2/` directory.
For the named lens, both `-shadows-{false,true}-scene.png` states, their
`-details-1.png` companions, and `-shadows-true-drag.png` were reviewed.
The ice filename prefix is `ice-absorption`. All 30 PNG byte counts and
SHA256s match the reports. Eight detail captures are identical to their scene
captures; the distinct normal/flood and ice/flood detail images at both DPRs
were inspected separately.

The derived [source-map panel](source-review/source-maps.png), SHA256
`4903958c44ddaddf4bb7d33c20a7b999c6dbe9654fac0c8a43120e7ab5be5e88`,
matches its [receipt](source-review/source-maps.json). Both current Phoebe
input pins match: infrared display
`f22812b0e21b9f448bd83482bd2a664cafe67ea6f8dc23e8c0e205dd0c3e2e8b`
and ice absorption
`d4b6945058358ceb42460ef5966e1ece2a5e1eb6bf481847b25ab42ff835ca1b`.

## Findings

- **Normal:** the existing SPC relative-brightness material remains coherent
  on the irregular retained body at both DPRs. Its title, grayscale legend and
  summary identify it as a model normalized near one, disclose missing source
  support, and explain the fixed 3,500-face approximation. The display is not
  presented as natural color or measured geometric albedo. This review does
  not assert pixel-identical parity against a pre-B9 browser capture.
- **Infrared:** the upper isolated islands, larger middle group, lower strips
  and detached lower side patches agree in broad arrangement with the source
  diagnostic. The near-neutral false-color patches remain distinguishable
  from the darker gray grid. Narrow detector gaps and broad unobserved regions
  remain visible. The close framing makes this small region useful while the
  thumbnail conveys its limited global extent. Bilinear/WebP edge softening is
  present; exact source-mask-edge parity is not claimed.
- **Ice absorption:** the same sparse spatial support is retained. Darker blue
  patches in the upper middle group and pale green/cyan patches in the lower
  group are recognizable from the source diagnostic. The nearest-sampled
  scalar colors vary between native samples without visually interpolating
  across the broad gray gaps. No continuous global chemistry is implied.
- **Scientific interpretation:** both new controls visibly say “Regional
  VIMS” and both titles show 11 June 2004. Infrared names the three false-color
  wavelengths, small flyby region, gray gaps, retained illumination/filtering
  and several-kilometer placement uncertainty. Ice absorption explicitly says
  the region is small and coarsely placed; values are uncorrected, affected by
  viewing angle, grain size, noise and archive filtering, and do not measure
  ice abundance.
- **Legend and layout:** the 0.1 / 0.2 / 0.3 band-depth-fraction legend is
  legible at DPR1 and DPR2. Its two-line unit does not collide with the middle
  label or summary. The existing rail scrolls slightly for the full ice and
  normal descriptions; the selected control, source title, thumbnail, legend
  and scientific context remain readable together. RGB correctly has no
  scalar legend. The original relative-albedo control label is ellipsized,
  while its model detail and source title identify the existing view.
- **Lighting and drag:** the sample islands remain attached after the captured
  drags. Directional lighting adds pronounced coarse terrain/facet shading to
  both scientific materials, darkening some islands; flood lighting exposes
  the whole accepted region. At close zoom a few fine terrain-face boundaries
  are visible in gray unsupported areas. These are recorded limits of the
  fixed presentation, not additional measured structure or photometric
  correction. No detached sample island or gross map discontinuity was found.

## Source and runtime limits

The body-owned preparation receipt records observation `1465671822_1`, 41
accepted original detector samples for each scientific view, and the unchanged
3,500-face terrain. The displayed patches can occupy many output texels; that
display density is not additional independent measurement or finer native
resolution. The receipt explicitly qualifies placement as a nominal regional
fit with a limb holdout residual of about one native fast-axis sample, not
exact absolute positioning or an integrated detector PSF. This visual review
does not tighten that uncertainty or independently re-establish the source
registration. Source-model, pointing, masking and numerical checks remain
separate evidence.

Both normal reports have 17 loaded object-asset responses; each scientific
report has 18. All responses are HTTP 200 and match their recorded
local/prepared artifacts. All six cases have no recorded errors and complete
context/browser closures. All twelve pre-drag states have stable retained
state, unchanged owner identity, no app error, and canonical prepared density
2. All six drag records report retained stability and owner identity.

The reports disclose the hidden upstream public settings button and use of
its existing hidden-input binding for Shadows. This review accepts the
captured states, not public settings reachability. Six successful isolated
runs do not establish a successful combined cohort run, compositor FPS,
general workstation safety or readiness of the subsequent upstream merge.

## Final main integration review

Accepted again on 2026-09-10 after integration at capture HEAD
`80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`. These six successful serial
captures supersede the earlier captures for integration acceptance. The source
interpretation and coarse regional-placement limits above remain unchanged.
They use Chrome `152.0.7977.84` and a 1440 × 1000 CSS-pixel viewport.

All paths below are under `output/playwright/b9-surfaces/`.

| DPR | Lens | Report path | Report SHA256 |
| --- | --- | --- | --- |
| 1 | normal | `integrated-2026-09-10T01-04-13.533Z/report.json` | `2123760ee63cc4af78a0f840b2091c9f16b09407bfebbbfe306011b43a4f7daa` |
| 1 | infrared | `integrated-2026-09-10T01-04-31.024Z/report.json` | `e6e85f55263e10f26bbb90367bf218ec10358f4ea663c0d2b03c6162a0b33fe2` |
| 1 | ice-absorption | `integrated-2026-09-10T01-04-53.887Z/report.json` | `1ece712154aa6a3d9638c60818051dd907c8edd69c883b4ad209252013f2d076` |
| 2 | normal | `integrated-2026-09-10T01-05-15.986Z/report.json` | `55eb06bf7b3a62b8250c8c319fd0434a06bcc38ab042a0843ff92b6ae876bede` |
| 2 | infrared | `integrated-2026-09-10T01-05-34.348Z/report.json` | `5d32ddb89421aad9523f4ac0186f5602b340b9c53baecd5f57f72b4657506df1` |
| 2 | ice-absorption | `integrated-2026-09-10T01-05-57.220Z/report.json` | `09fd20b4a1e6bfb07f51700d410ab835dfe1c496925bb107fb86e524abe4ee43` |

For each row the exact image directory is `phoebe-dpr<DPR>/` beside its report,
with the selected lens prefix followed by `-shadows-{false,true}-scene.png`,
`-shadows-{false,true}-details-1.png`, and `-shadows-true-drag.png`. All 30 PNG
byte counts and SHA256 pins were verified. All twelve scene images, six drag
images and four distinct normal/ice shadows-false detail images were visually
inspected. The other eight detail captures are byte-identical to their scene
captures.

The existing normal relative-brightness surface and irregular limb remain
coherent at both DPRs. The two new materials preserve the same separated upper
islands, central strips, lower patches and internal gray exclusions seen in the
accepted captures and pinned numerical source panel. RGB is near-neutral in
this region; the absorption palette still distinguishes blue upper/central
samples from the cyan and pale-green lower patches. The close regional focus
keeps all supported patches visible; some unsupported left limb lies behind
the rail. This has not expanded the 41 accepted source samples or their area.

Both DPRs visibly retain the 11 June 2004 date, Regional VIMS label, false-color
wavelengths, gray-gap explanation, illumination/filtering and several-kilometer
placement caveat. The absorption text fits with the 0.1 / 0.2 / 0.3
band-depth-fraction legend and the uncorrected, viewing-angle, grain-size,
noise/filtering and non-abundance explanation. The full normal-model caveat
also remains readable after the existing rail scroll. Shadows expose the same
coarse terrain facets and thin face boundaries in some gray areas; they do not
provide corrected science. Drag keeps the source patches attached. No new
packing, boundary or layout blocker was found in the v0.436/432-object context.

All loaded `public/scenes/phoebe/` response hashes equal their historical
accepted counterparts. Each normal run contains 17 object-asset responses and
each new-lens run 18, all HTTP 200 and matched. All twelve before-drag states
retain the same owner and stable nodes, canonical prepared density 2 and no
app error. All six drags retain nodes and owner and report stable. All case
error arrays are empty and all context/browser closures completed. The six
`output/b3-resume/b9-main-phoebe-<lens>-qualified-dpr<DPR>.json` monitors report
PASS. This final integration acceptance does not establish exact absolute
placement, extra independent samples, global coverage, native-camera RGB
parity, public settings reachability, compositor FPS or general Mac safety.
