# Moons PR batches

Owner: Moons · Planned 2026-09-08 · Based on the completed [484-body review](review-2026-09-08/BODY-REVIEWS.md).

The delivery unit is a substantial, complete outcome across a named cohort. Every PR includes its source intake, preparation, body integration, content, assets and qualification evidence. The user’s direction is to make meaningful advances in each PR.

**B1 and [B2 PR #62](https://github.com/layoutit/cssEarth/pull/62) are merged; [B3 merged PR #67](https://github.com/layoutit/cssEarth/pull/67) covers the approved six-moon scope after all 12 source reviews.** Work can proceed incrementally within a branch; each reviewable PR covers its complete agreed batch. A discovered source blocker triggers an explicit cohort/scope decision before delivery, preserving the intended scale and source fidelity. B3–B4 counts remain planning targets until their selected sources and implementations qualify.

| Batch | Outcome | Scope |
| --- | --- | --- |
| [B1 — Expand the moon roster by 26](#b1) | 26 new standalone moons merged; roster 69 → 95, benchmark coverage 90/461. | 26 bodies |
| [B2 — Add scientific surfaces and terrain to 13 moons](#b2) | 13 existing worlds gain a substantive scientific layer or source-backed geometry improvement. | 13 bodies |
| [B3 — Spacecraft color and scientific maps](#b3) | Six new views and three improved views; six researched targets carried forward. | 6 delivered + 6 carried |
| [B4 — Add measured light curves and spectra across nine existing moons](#b4) | A complete prepared observation-chart capability used by nine existing moon packages. | 9 bodies |

B1 added **22 benchmark moons**: 18 Saturn and four Uranus. Merged benchmark coverage is **90/461 (19.5%)**; four additional companions bring the total standalone moon count to **95**. The carried Dactyl/Selam research could support two future scenes, but neither is part of this delivery. The 461-body denominator is unchanged.

The four batches and B3 carry-forward queue account for **all 32 identified existing-scene improvements**, all **26 physical-model candidates**, and **two spacecraft-imaged observation candidates**. The other 39 observation candidates retain their source-research queue; 348 orbit-context rows and 37 retain-existing rows remain accounted for without a new implementation commitment.

<a id="b1"></a>

## B1 — Expand the moon roster by 26

**State:** [merged PR #55](https://github.com/layoutit/cssEarth/pull/55) · **Owner:** Moons

**Bodies:** Paaliaq, Tarvos, Ijiraq, Suttungr, Mundilfari, Skathi, Erriapus, Thrymr, Bebhionn, Bergelmir, Bestla, Fornjot, Hati, Hyrrokkin, Loge, Skoll, Greip, Tarqeq, Caliban, Sycorax, Prospero, Setebos, Hiʻiaka, Squannit, Romulus, Menoetius.

**User-visible outcome.** 26 new standalone moons merged; roster 69 → 95, benchmark coverage 90/461.

**Complete delivery.** A complete source-backed body package for every selected target: physical-model interpretation, parent-relative orbit, orientation limits, preparation, retained rendering, navigation, content, thumbnails, source restoration and qualification evidence.

**Source closure before implementation.** Resolve actual source identities, scale, axes, frame, orbit window and any selected ancillary-file terms for all 26 before expensive preparation. Use the reviewed mesh or explicitly observation-constrained approximation. Published minimum elongation, assumed polar dimension and tentative spin must remain visible; this batch does not promise 26 measured terrain surfaces.

**Acceptance.** All 26 have standalone routes and reproducible inputs; package/registry counts match; independent physical/orbit anchors and real Chrome DPR 1/2 evidence cover every new object. Preserve one generic adapter and one mounted scene.

<a id="b2"></a>

## B2 — Add scientific surfaces and terrain to 13 moons

**State:** [merged PR #62](https://github.com/layoutit/cssEarth/pull/62), 2026-09-09 · **Owner:** Moons

The user approved the 13-body delivery, carrying Titania and Miranda into B3.

See [B2 implementation and qualification](B2-SCIENTIFIC-SURFACES.md) and its [delivery evidence](b2-preparation/final/DELIVERY.md). Main `4848897ee` is integrated; all 13 preparations and fresh source restorations passed. All 551 published runtime images installed without cache reuse. Final browser reviews and aggregate gate outcomes remain separate from implementation completion.

**Bodies:** Moon, Phobos, Deimos, Dimorphos, Io, Europa, Ganymede, Enceladus, Tethys, Dione, Rhea, Titan, Charon.

**User-visible outcome.** 13 existing worlds gain a substantive scientific layer or source-backed geometry improvement.

**Complete delivery.** Ship the shared preparation capabilities together with their body-specific consumers. Complete selected geometry/lenses, validity and confidence treatment, units/datums, scientific legends, thumbnails/minimaps and provenance as one user-visible surface upgrade.

**Source closure before implementation.** Pin at least one genuinely new, supported product per body before freezing final implementation details. Resolve archive access and coordinate conventions; distinguish measured, interpolated and modeled support. Source-defined regional coverage and thermal local-time bins remain explicit.

**Acceptance.** Each of the 13 bodies demonstrates the promised new information with independent source-to-display checks. Geometry changes preserve map registration and interaction behavior. A presentation improvement must add supported information rather than simply resample an existing image.

<a id="b3"></a>

## B3 — Spacecraft color and scientific maps

**State:** [merged PR #67](https://github.com/layoutit/cssEarth/pull/67) · **Owner:** Moons

**Bodies:** Callisto, Hyperion, Phoebe, Proteus, Titania, Miranda.

**User-visible outcome.** Six new selectable views and three improved existing views. Titania and Miranda's exact GIS releases were recovered and registered, completing the work carried from B2.

**Complete delivery.** Galileo processed color for Callisto; a close-image contribution to Hyperion's controlled mosaic; Phoebe's paired 2023 shape/albedo/height and coverage products; Voyager filter color for Proteus; and categorical geology for Titania and Miranda. Shared preparation preserves source masks, numeric sampling and regional camera focus through the existing object contract.

**Evidence.** All six pass 23 body tests, 18 source/runtime-closure checks, 34 isolated Chrome runs covering 17 views at DPR1/2, and a fresh installation of 228 immutable assets with zero reuse. Full build/renderer qualification remains incomplete under resource limits; the [delivery report](b3-preparation/final/DELIVERY.md) separates these limits from the selected moon results.

**Approved carry-forward.** Dactyl, Selam, Thebe, Aegaeon, Nix and Hydra retain their [source dispositions](B3-SPACECRAFT-MAPPING.md). Their original research is preserved. No new scene, unsupported footprint or unique registration is claimed for them.

<a id="b4"></a>

## B4 — Add measured light curves and spectra across nine existing moons

**State:** [draft PR #70](https://github.com/layoutit/cssEarth/pull/70), paused at the user’s request · **Owner:** Moons

**Bodies:** Himalia, Epimetheus, Telesto, Pandora, Ymir, Albiorix, Siarnaq, Methone, Pallene.

**User-visible outcome.** A complete prepared observation-chart capability used by nine existing moon packages.

**Complete delivery.** Prepare numeric charts and uncertainty information ahead of runtime, integrate them through shared supported capabilities, and supply all nine body datasets and explanations. Each chart identifies the observed quantity, units, date/phase and inference limits.

**Source closure before implementation.** Pin released numeric data or reproducible extraction inputs. The review identifies actual CSV/text for some targets and archive/reduction work for others. Normalize and validate each measurement on its own terms; disk-integrated spectra do not provide a spatial mineral map.

**Acceptance.** All nine bodies expose useful measured observations with source/error checks, accessible content and stable retained DOM. Runtime consumes prepared results. The feature is exercised end to end by the full cohort.

## B6 — Mapped scientific surfaces across four existing moons

**State:** [merged PR #76](https://github.com/layoutit/cssEarth/pull/76); selected-body qualification and runtime delivery complete · **Owner:** Moons

Six new views: Moon geology and Diviner silicate signature, Europa geology and
Galileo NIMS infrared, Callisto Galileo NIMS infrared, and Charon modeled Bond
albedo. Source preparation, maps and explanatory content use the existing object
contract. Renderer, runtime, shared camera/shell/navigation and shape geometry
remain fixed. See [scope and source decisions](B6-MAPPED-SCIENCE.md) and the
[visual review, source checks and delivery receipts](b6-mapped-science/VISUAL-REVIEW.md).

This follow-up deepens four scenes already counted above. It adds no moon to the
roster or benchmark denominator. B4 observation charts remain in draft.

## B7 — Cassini surface atlas

**State:** [draft PR #81](https://github.com/layoutit/cssEarth/pull/81), implemented and delivered; pending aggregate qualification · **Owner:** Moons

Five mapped views across **Titan, Dione and Rhea**: Titan's six-unit global
geomorphology and paired Cassini VIMS infrared / water-ice absorption views for
Dione and Rhea. The atlas uses original released polygons and spectral cubes,
with explicit source coverage and registration limits. Existing scene geometry,
renderer, camera and shared shell remain unchanged. The new image inventory is
17 files / 1,873,728 bytes across all three bodies. The selected 32-case DPR1/2
browser matrix and shared ownership audit pass on the `a5a34bde` integration;
full-repository qualification and public Settings reachability remain open.

See [scope and reproduction](B7-CASSINI-ATLAS.md), [source review](b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md)
and [visual qualification](b7-cassini-atlas/VISUAL-REVIEW.md). This deepens existing
scenes; the moon roster and benchmark denominator do not change. B4 remains a
paused draft at the user's request.

## Parallel execution

Use subagents when independent work reduces elapsed time. For B1, divide body-owned source intake and package work into disjoint cohorts while the Moons owner handles shared preparers, registry integration and final qualification. Integrate the complete batch into one PR. Check source closure before preparation. Serialize expensive bakes, builds, tests and browser capture across lanes; honor the shared disk and memory limits.

## Shared completion requirements

Each batch retains the generic object contract, one mounted scene and preparation-owned static work. Required source and runtime closure, package/router checks, `pnpm acquire:planets -- --verify-only`, `pnpm test`, `pnpm build`, `pnpm test:browser`, and real Chrome DPR 1/2 evidence apply at the exact PR head. Report existing aggregate failures separately from regressions and from unproven scientific interpretation.

Source acquisition/preparation must follow workstation disk and process guardrails. Execution requires a suitable checkout that preserves unrelated work; the original planning pass changed only moon documents. B1 merged through [PR #55](https://github.com/layoutit/cssEarth/pull/55), using the existing Moons worktree; see [qualification status](B1-EXPANSION.md).

## Planning validation

The structured [batch membership](PR-BATCHES.json) was checked against the frozen review: **60 unique assigned bodies**, **28 prospective new scenes**, **32 existing improvements**, every physical-model candidate assigned exactly once, and every existing improvement assigned exactly once. The remaining **424** reviewed rows plus these **60** account for the full **484**.
