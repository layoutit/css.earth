# Qualification and delivery

Use the current repository contracts and existing checks. Follow the
[documentation contract](../../../../docs/provenance/CONTRACT.md) to identify the
tested version, save results and explain any reused evidence. For a repair,
check the defect and affected behavior. For a new body, also check its package,
required sources and installable assets. Reuse completed checks that still apply.

## Check what changed

| Change | Relevant evidence |
| --- | --- |
| New/changed source or preparation | Body/preparer tests, source validity and coordinate interpretation, prepared asset closure, source-to-result visual inspection. |
| New acquisition path or missing restoration evidence | Restore its required ignored inputs into an empty temporary destination using the documented acquisition path. Preserve working inputs; cached verification does not prove restoration. |
| Body registration/content | Package contract, reachable route/search/parent context, supported controls and correct attribution. |
| Shared runtime or a new capability | Existing affected conformance for retained DOM, decode/readiness, lens races, pause/resume, destroy/cancellation, drag/wheel/fly-to and resource cleanup. Cover supported behavior and absence of unsupported UI/assets. |
| Changed presentation | Reported view plus relevant close zoom, limb, pole/seam/shape extremes and lighting states; matched established-body views when shared behavior changed. |
| New triangle-mesh presentation or mesh reduction | Source-fit and topology checks from [irregular meshes](irregular-meshes.md), plus [matched drag and cost measurements](#measure-mesh-changes). |
| Changed delivery | Fresh installation against the published runtime inventory; complete cold-load and incremental lens costs. |

Use behavioral assertions or independent source/numerical cases for a real
regression. Do not duplicate shared conformance per body or test instruction
wording. A renderer-wide change warrants broader regression work than a source
thumbnail change. Add performance traces when observed cost or changed runtime
behavior justifies them; missing features do not need invented test scenarios.

For readiness, follow the user's and current `AGENTS.md` requirements. The
established aggregate commands are:

```sh
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser
```

Inspect `package.json` and runner arguments before selecting focused commands.
`pnpm test` does not currently include `test:planets` or `test:preparation`;
`test:browser` runs DOM cleanliness, while `test:browser:conformance` is separate.
Run the relevant body/preparation checks too. Reuse completed runs that still
cover the result; distinguish focused passes from unresolved aggregate failures.
Do not repair unrelated systems just to make this body's report green.

## Inspect actual browser output

Use the server selected in the main workflow. Bind captures to its checkout and actual
prepared files, including ignored/dirty assets, plus camera/lens/settings,
viewport, DPR and browser. Test real Chrome at DPR 1 and 2; sample responsive
layouts applicable to the change rather than adding a device matrix.
Production routes may lack development diagnostics; use public observables.
Run automated captures and traces headless by default. Respect the user's focus;
show a requested preview in the existing app panel without raising a separate
browser window.

Inspect the images, not just successful screenshot commands. Look for missing
detail, wedges, seams, clipping, misplaced lighting and blank/missing content.
For a like-for-like visual comparison, show reference, browser result and
absolute diff with matched coordinates/framing. Otherwise show the source and
result with the comparison's limits; do not fabricate a native oracle or claim
pixel parity between unrelated views. Mark unbound comparisons `INVALID`.

## Measure mesh changes

Measure an early usable mesh before expensive presentation expansion, and repeat
the affected comparison after reduction. Start from the user's camera, zoom,
lens and lighting state; keep viewport, DPR, browser and gesture matched. Include
supported lighting states in visual checks even if the drag benchmark uses one.

Count actual mounted leaves and inspect their tags, raster sizing, dimensions
and retained identity. Source face count alone does not explain draw cost.
Record atlas dimensions and decoded pixel storage separately from install bytes
and measured GPU residency. Similar leaf counts across projects are not a
performance diagnosis; inspect their primitive, raster footprint and rendering
work before attributing dropped frames to geometry count or GPU overload.

Use the existing input/trace harness. Report observed draw cadence and draw-time
distribution for the matched workload, with screenshot and prepared-file
provenance. A local trace does not establish steady performance at every pose
or hardware GPU saturation. Preserve the accepted reference while comparing
quality and cost; once focused checks pass, reuse them until a relevant change
or failure warrants another run. A face-budget adjustment alone does not justify
repeating all-object browser suites.

## Deliver usable assets

For a new distributable body or changed runtime assets, verify the documented
`pnpm setup:assets --object=<id>` path in a destination without cached scene
assets or links to another checkout. It must need neither source preparation
nor unrelated body data. Exercise its route and selected views, including shared
shell assets; reuse that installation for relevant browser work. Publish through
the existing asset publisher when authorized. Unavailable remote URLs mean
remote installation is still unproven.

Separate cold network transfer, incremental lens downloads, total install size
and decoded memory. Include shared shell/background assets and JSON transport
when reporting a scene total, including worker requests. Development traffic
and calculated gzip/Brotli sizes are not measured production transfer. Keep
matched framing and workloads when comparing quality or cost.

Put the results and known problems in the body's README, alongside its source
explanation. Link the original test reports and inspected screenshots. Keep
lengthy source calculations in the existing source notes. A recovered provenance record
does not prove the preparation was rerun.

Report concise outcomes and useful visual links, source/processing limitations
and any outstanding failure. Do not equate skill validation, registry presence,
cached assets or a unit-test pass with a visually accepted, installable body.

For reproduction, name the expected inventory before running and compare the
regenerated files against it. An inventory made only from the new output does
not prove reproduction of the old result. Link existing manifests. Keep old
reports tied to their tested versions; explain any reuse for a new version in
the README’s evidence section.
