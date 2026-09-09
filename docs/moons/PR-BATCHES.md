# Moons PR batches

Owner: Moons · Planned 2026-09-08 · Based on the completed [484-body review](review-2026-09-08/BODY-REVIEWS.md).

The delivery unit is a substantial, complete outcome across a named cohort. Every PR includes its source intake, preparation, body integration, content, assets and qualification evidence. The user’s direction is to make meaningful advances in each PR.

**B1 is merged; B2 is in implementation.** Work can proceed incrementally within a branch; each reviewable PR covers its complete agreed batch. A discovered source blocker triggers an explicit cohort/scope decision before delivery, preserving the intended scale and source fidelity. B2–B4 counts remain planning targets until their selected sources and implementations qualify.

| Batch | Outcome | Scope |
| --- | --- | --- |
| [B1 — Expand the moon roster by 26](#b1) | 26 new standalone moons merged; roster 69 → 95, benchmark coverage 90/461. | 26 bodies |
| [B2 — Add scientific surfaces and terrain to 13 moons](#b2) | 13 existing worlds gain a substantive scientific layer or source-backed geometry improvement. | 13 bodies |
| [B3 — Complete spacecraft imagery and geologic mapping](#b3) | Two prospective new imaged moons, eight existing observation/registration improvements, and two carried-forward geologic maps. | 12 bodies |
| [B4 — Add measured light curves and spectra across nine existing moons](#b4) | A complete prepared observation-chart capability used by nine existing moon packages. | 9 bodies |

B1 added **22 benchmark moons**: 18 Saturn and four Uranus. Merged benchmark coverage is **90/461 (19.5%)**; four additional companions bring the total standalone moon count to **95**. B3 could subsequently add two further asteroid moons. The 461-body denominator is unchanged.

These four batches account for **all 32 identified existing-scene improvements**, all **26 physical-model candidates**, and **two spacecraft-imaged observation candidates**. The other 39 observation candidates retain their source-research queue; 348 orbit-context rows and 37 retain-existing rows remain accounted for without a new implementation commitment.

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

**State:** implementation; all 13 body preparations complete; browser and aggregate qualification in progress · **Owner:** Moons

The user approved the 13-body delivery, carrying Titania and Miranda into B3.

See [B2 implementation and qualification](B2-SCIENTIFIC-SURFACES.md). PR #56 is integrated at `7030be3b`; all 13 source-ready body preparations have passed, including the three Jovian bodies after source-coordinate corrections. No B2 body is yet marked browser-qualified.

**Bodies:** Moon, Phobos, Deimos, Dimorphos, Io, Europa, Ganymede, Enceladus, Tethys, Dione, Rhea, Titan, Charon.

**User-visible outcome.** 13 existing worlds gain a substantive scientific layer or source-backed geometry improvement.

**Complete delivery.** Ship the shared preparation capabilities together with their body-specific consumers. Complete selected geometry/lenses, validity and confidence treatment, units/datums, scientific legends, thumbnails/minimaps and provenance as one user-visible surface upgrade.

**Source closure before implementation.** Pin at least one genuinely new, supported product per body before freezing final implementation details. Resolve archive access and coordinate conventions; distinguish measured, interpolated and modeled support. Source-defined regional coverage and thermal local-time bins remain explicit.

**Acceptance.** Each of the 13 bodies demonstrates the promised new information with independent source-to-display checks. Geometry changes preserve map registration and interaction behavior. A presentation improvement must add supported information rather than simply resample an existing image.

<a id="b3"></a>

## B3 — Complete spacecraft imagery and geologic mapping

Titania and Miranda moved here from B2 by explicit user approval. Their exact GIS releases remain inaccessible; release access and georeferencing must close before implementation.

**State:** planned · **Owner:** Moons

**Bodies:** Dactyl, Selam, Callisto, Thebe, Hyperion, Phoebe, Aegaeon, Proteus, Nix, Hydra, Titania, Miranda.

**User-visible outcome.** Two prospective new imaged moons, eight existing observation/registration improvements, and two carried-forward geologic maps.

**Complete delivery.** Deliver the observed views and all required camera/attitude, photometric, visibility and coverage preparation. Include source-frame comparisons and holdout registration evidence across the cohort. Any necessary shared registration improvements ship with these complete uses.

**Source closure before implementation.** This batch carries substantial research risk: several fitted attitudes, original calibrated frames or numeric mapping releases remain unresolved. Resolve the target-specific blocker in the review before opening the implementation PR. A new full-disk photograph may support a dated observation view without becoming a global texture.

**Acceptance.** Two new scene claims require qualified geometry as well as real images. Each existing body gains a defensible observation improvement; photographed lighting, unseen terrain, source sampling and temporal differences remain clear. The full cohort is the planning target, with any scope change recorded explicitly.

<a id="b4"></a>

## B4 — Add measured light curves and spectra across nine existing moons

**State:** planned · **Owner:** Moons

**Bodies:** Himalia, Epimetheus, Telesto, Pandora, Ymir, Albiorix, Siarnaq, Methone, Pallene.

**User-visible outcome.** A complete prepared observation-chart capability used by nine existing moon packages.

**Complete delivery.** Prepare numeric charts and uncertainty information ahead of runtime, integrate them through shared supported capabilities, and supply all nine body datasets and explanations. Each chart identifies the observed quantity, units, date/phase and inference limits.

**Source closure before implementation.** Pin released numeric data or reproducible extraction inputs. The review identifies actual CSV/text for some targets and archive/reduction work for others. Normalize and validate each measurement on its own terms; disk-integrated spectra do not provide a spatial mineral map.

**Acceptance.** All nine bodies expose useful measured observations with source/error checks, accessible content and stable retained DOM. Runtime consumes prepared results. The feature is exercised end to end by the full cohort.

## Parallel execution

Use subagents when independent work reduces elapsed time. For B1, divide body-owned source intake and package work into disjoint cohorts while the Moons owner handles shared preparers, registry integration and final qualification. Integrate the complete batch into one PR. Check source closure before preparation. Serialize expensive bakes, builds, tests and browser capture across lanes; honor the shared disk and memory limits.

## Shared completion requirements

Each batch retains the generic object contract, one mounted scene and preparation-owned static work. Required source and runtime closure, package/router checks, `pnpm acquire:planets -- --verify-only`, `pnpm test`, `pnpm build`, `pnpm test:browser`, and real Chrome DPR 1/2 evidence apply at the exact PR head. Report existing aggregate failures separately from regressions and from unproven scientific interpretation.

Source acquisition/preparation must follow workstation disk and process guardrails. Execution requires a suitable checkout that preserves unrelated work; the original planning pass changed only moon documents. B1 merged through [PR #55](https://github.com/layoutit/cssEarth/pull/55), using the existing Moons worktree; see [qualification status](B1-EXPANSION.md).

## Planning validation

The structured [batch membership](PR-BATCHES.json) was checked against the frozen review: **60 unique assigned bodies**, **28 prospective new scenes**, **32 existing improvements**, every physical-model candidate assigned exactly once, and every existing improvement assigned exactly once. The remaining **424** reviewed rows plus these **60** account for the full **484**.
