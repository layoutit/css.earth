# B1 scientific integration check

Checked on branch `feat/moons-26-expansion`, at scene epoch **JD 2461286.5 TT**.

Integrated numerical checks refreshed at 2026-09-08T21:59:49.838Z.

The 26 new moons have consistent body identities, reference radii, parent-relative states and prepared presentation frames. The 68 existing fitted satellite records remained byte-identical when the 22 new fits were added.

| Check | Result |
| --- | --- |
| New body metadata and relative positions | All 26 reference radii match their authored shape recipes; all parents match astronomy. Maximum generated-versus-source-model relative-position discrepancy: 5.97×10⁻⁹ km (about 6 micrometres). |
| Fixed-epoch public API | All four companion states reject adjacent epochs; their accuracy metadata declares one supported instant and no numerical accuracy bound. Scene-only moons are excluded from propagated dwarf-planet frame specifications. |
| Canonical primary states | The generated canonical map retains Haumea, Sylvia and Patroclus source position and velocity. The current planetary-system preparer derives matching parent conics from those states and solar GM; shared physical world frames and world-context preparation consume the canonical positions. This does not assert that every cached body-local view was regenerated. |
| Context-only primary | Patroclus supplies an orbit origin for Menoetius; it adds no standalone scene, surface or marker. Context preparation rejects missing, displaced, duplicate and cyclic origins. |
| Prepared body presentation | All 26 `scene.systemTransform` values matched the ecliptic presentation frame at the recorded check. This tests each surface carrier, not every cached `heliocentricView.plan`. |
| Focused tests | 28 solar/planetary tests passed against the integrated geometry. Earlier focused results remain: 6 core context tests and 4 context-adapter tests passed after the canonical geometry and parent refresh; that adapter test used real prepared descriptors. Final aggregate qualification is separate. |
| Regeneration | The four-state generator validates the whole cohort before replacing output. It rejects partial-selection arguments. Two isolated CLI tests passed. |

The micrometre-scale discrepancy measures numerical agreement between representations of the same adopted orbit model. It does not measure physical position accuracy, which remains limited by the source solution and its stated uncertainties.

## Prepared-view scope

[`prepare-object-json.mjs`](../../../tools/prepare-object-json.mjs) updates physical world frames, navigation markers, descriptors and authored shared contexts. It does **not** call `refreshSolidSceneEpoch` or regenerate every body-local `heliocentricView.plan`; older cached plans may retain previous parent conics. When the shared application context is mounted, [`scene-router.mjs`](../../../site/scene-router.mjs) passes `externalWorldContext`, and the [object renderer](../../../src/renderers/css/runtime/object-runtime.ts) suppresses the body-local heliocentric layer. The source-state/conic tests qualify the current preparer and shared-context path, without claiming that every legacy cached plan was refreshed.

## Interpretation limits

- The 22 Saturn/Uranus fits carry sampled residuals over their retained fit interval. These residuals describe the compact fit and are neither global bounds nor statistical uncertainties.
- Hiʻiaka uses retained JPL #110 primary/satellite states. The stated 900 km source uncertainty applies to 2025 January, not the scene epoch; this is not the newer 2024 interacting solution.
- Menoetius uses the retained JPL #82 physical-primary pair, with the solution's own GM values. The response provides no scene-epoch covariance bound.
- Squannit uses the published phase-bearing orbit and measured quadratic mean-anomaly drift. The 2026 extrapolation has roughly 55° summed component phase sensitivity, which is not a confidence interval. Its original radar mesh scale remains separate from the later photometric preference for a larger secondary.
- Romulus uses a rounded published orbital solution. Its retained independent projection discrepancies reach about 63 mas; the paper's 9.85 mas fit RMS is not achieved by the rounded reconstruction. Its nominal TT interpretation and ambiguous source epoch scale remain disclosed.
- Source geometry, assumed dimensions and display attitude are separate quantities. None of these numerical closure tests turns an unresolved surface or arbitrary display phase into an observation.

The root task owns aggregate build, renderer and final visual qualification. This report records scientific integration checks; the 26-body Chrome DPR1/2 run remains pending the full build's descriptor phase.

## Retained evidence

The four object-owned records retain source identities, hashes, epochs, gravity values, composition checks and model qualifications:

- [Hiʻiaka epoch state](../../../src/planets/hiiaka/source/validation/epoch-state.json)
- [Squannit epoch state](../../../src/planets/squannit/source/validation/epoch-state.json)
- [Romulus epoch state](../../../src/planets/romulus/source/validation/epoch-state.json) and [independent projection checks](../../../src/planets/romulus/source/validation/projection-checks.json)
- [Menoetius epoch state](../../../src/planets/menoetius/source/validation/epoch-state.json)

The companion [machine report](science-integration.json) pins the checked shared modules. Preintegration browser evidence remains separate. Final lane summaries are written to `output/playwright/moons-b1-qualification/final-jupiter-summary.json` and `final-saturn-summary.json`, with per-body reports under `output/playwright/moons-b1-final-<id>/attempt-<n>/report.json`; it is a separate qualification step.
