# From the solar system to a universe explorer

Architecture proposal · 6 September 2026 · cssEarth `807601d` · Galaxio `b6475ad`

**Recommended: migrate shared behavior while proving a Milky Way representation.** Pin the compatibility seam, then develop frame-anchored navigation and a bounded galaxy image-bank prototype in parallel with alowpoly’s planet-detail migrations. Keep the CSS renderer and Node preparation adapters outside the agnostic packages, and convert their remaining JavaScript to TypeScript there.

This is a proposal, not an implementation. Main was fast-forwarded to the merged PR. No application behavior or planet data was changed.

## What is actually left

Tracked code files in the four requested directories; MJS counts include tests. “Production MJS” excludes tests, browser harnesses and generated source.

| Directory | MJS | TS | Production MJS | Meaning |
|---|---:|---:|---:|---|
| `src/platform` | 140 | 0 | 82 | The main shared-code migration backlog: pure behavior, browser rendering and offline preparation mixed together. |
| `src/preparation` | 0 | 7 | 0 | Already TypeScript. Its image/file adapters need cleaner ownership, not extension changes. |
| `src/renderers` | 4 | 100 | 0 | Already TypeScript apart from four browser harnesses. Still partly duplicates platform behavior. |
| `tools` | 68 | 14 | 44 | Mixes CLI orchestration, validation, source acquisition and reusable preparation. |

The 126 production MJS files total 21,014 physical lines. This is an inventory, not an estimate of how many lines belong in packages. Tests and tool configuration also need a TypeScript plan; they are not engine code.

## The six consequential smells

1. **Two implementations of shared behavior.** Legacy objects and the shell use platform modules; Mercury/Venus use the typed renderer and engine. Camera math, drag, lifetime and photometry have parallel implementations. Fixes can diverge. Make the package implementation authoritative and preserve compatibility facades for existing callers.
2. **Application policy leaks downward.** Platform contracts import the site; preparation adapters dynamically load the site registry and platform modules from the working directory. Extract neutral contracts and inject application policy at the entrypoint. These are layer inversions, not evidence of a direct ESM cycle.
3. **Image preparation reaches into CSS preparation and back.** The raster entry calls a CSS-owned lighting writer, which imports raster I/O. Separate pixels, encoded files and CSS frame-address records. Moving either whole folder would preserve the coupling.
4. **Build boundaries do not explain ownership.** Renderer preparation is excluded from the renderer runtime build and compiled through the tools configuration. Keeping browser and Node outputs separate is correct; the missing seam is an explicit typed offline renderer API with its own dependency guard.
5. **The camera is still tied to a prepared solar snapshot.** The active conversion adds a local offset to an absolute metre origin and requires matching reference frame/epoch. Astronomy already supplies relative frame-tree resolution. Use that foundation before expanding the camera to galactic distances; preserve existing saved URLs through a compatibility decoder.
6. **A surface recipe is not a universal object model.** The generic envelope is extensible, but the authored recipe requires a sphere/ellipsoid and mapped surfaces. A point catalog, cluster or nebula needs identity, location quality, spatial extent and supported representations without pretending to be a textured planet.

## Intended ownership

| Owner | Responsibilities | Excludes |
|---|---|---|
| `packages/astronomy` | Units, time, reference frames, scientific transforms and existing bounded ephemerides. | CSS, application registry, scene style and camera input. |
| `packages/catalog` | Versioned columnar format, validated decoding and encoding. | Search UI, per-object customizations and scene ownership. |
| `packages/engine` | Anchored observer, numeric flight/selection, lifecycle, representation transitions and resource-budget policy. | DOM, file/image APIs, object recipes and CSS matrix strings. |
| `packages/objects` | Validated identity/representation capabilities and generic geometry/pixel preparation. | Individual objects, image codecs, CSS trees and application content policy. |
| `src/renderers/css` | Retained DOM/CSS rendering, projection, occlusion, browser input and a separate offline CSS compiler. | Scientific catalogs and general navigation algorithms. |
| `src/preparation` | Node/image adapters: source decoding, resizing, encoding, file outputs and hashes. | Runtime rendering and application navigation policy. |
| `tools` and `site` | Thin TypeScript entrypoints assembling services; CLI/build policy and the application shell respectively. | Duplicate implementations of shared algorithms. |

Keep the four existing packages. A new package named after each current folder would add boundaries without fixing ownership. Preserve the current engine-to-objects dependency prohibition: the application supplies plain navigation targets to the engine after interpreting object capabilities.

## Migration order and real prerequisites

| Step | Work | Must other planets migrate first? | Evidence needed before advancing |
|---|---|---|---|
| **1. One behavior source** | Route legacy and typed callers through the existing engine math/lifetime implementations; keep browser waits in renderer adapters. Extend dependency guards to adapter lanes. | **No.** Existing exports can remain as compatibility facades. | Old callers and typed callers retain behavior; a second implementation or forbidden import makes a guard fail. |
| **2. Explicit preparation seams** | Inject celestial/frame/content providers; retain the frozen solar snapshot provider. Separate raster writing from CSS addressing and expose an offline CSS preparation entry. | **No.** Preserve current output formats and bytes. | Mercury/Venus prepared-output parity, source/asset closure and clean dependency direction. |
| **3. An anchored world model** | Use astronomy frame snapshots with anchor + local offset + orientation; centralize selection identity and numeric scale policy. Keep CSS conversion at the renderer edge. | **No.** Mercury/Venus are sufficient integration consumers. | Equivalent anchors project the same pixels; interrupted flight and old/new saved views preserve observer state. |
| **4. One bounded universe journey** | Add prepared nearby-star context, then one galactic/deep-sky representation with stable identity, known distance and a declared viewing envelope. | **No.** Legacy details may continue behind adapters. | Bounded retained nodes/decoded bytes, actual parallax, alignment, no duplicate identity or handoff gap. |
| **Parallel: remaining details** | Migrate each object's ring, atmosphere, terrain, paging or other missing detailed capability through the same contracts. | Only that object's full-detail experience depends on it. | Its existing visual/source oracle and common browser conformance. |
| **Finally: retire compatibility** | Remove legacy platform runtime, old adapters and formats after their last consumer moves. Convert remaining harnesses/CLIs to TypeScript in their own lanes. | **Yes, for deletion.** Not for earlier extraction or universe experiments. | Consumer closure is empty and the complete supported-object suite passes. |

A capability may need extending before a particular detail scene can adopt the typed renderer. That blocks the scene's adoption, not camera math, frame anchoring, catalog identity or preparation-provider extraction. “Wait for every planet” is therefore the wrong project dependency.

## What Galaxio teaches us—and what it does not prove

The frame-tree implementation and GXCT format are already present here and match the inspected Galaxio files. Its camera reanchors with hysteresis; its render-altitude follower smooths representation changes separately from camera motion. Reuse those numeric ideas with prepared epoch snapshots. Do not introduce runtime generation of geometry or source assets.

Its actual outer frames place `sol` and `mw` as siblings below `cmb`. Coordinate hierarchy is a precision structure, not a taxonomy of what contains what.

**Messier is a cross-class identity collection, not a zoom level:** M42 is a nebula, M31 a galaxy. Search, labels, picking, routes and detailed representations must share identities and aliases. Keep missing distances explicitly unknown; a direction-only catalog record must not gain a fabricated 3D fly-to target.

The present cubic sky is a directional backdrop, not a traversable star field. Galaxio renders roughly 100,000 GPU instances and raymarches volume textures. Those techniques do not establish CSS/DOM scalability or volumetric quality. Keep one detailed scene with retained context representations, then measure the CSS approach.

Use whole prepared catalogs when they fit the budget; introduce prepared chunks only when measurements justify them. Paging beyond Earth's existing exception would require an explicit contract change. A finite image/view bank can serve a declared camera envelope; arbitrary travel through a nebula or Milky Way volume remains an unproven rendering problem.

## Recommended foundation slice

**Consolidate legacy camera math and lifecycle onto `packages/engine`.** Keep old import paths as narrow facades, move native document/paint waits into browser adapters, and make both runtimes consume the same implementation. Use existing parity, cancellation, router and browser checks; do not change the URL wire format, solar epoch, prepared assets or object recipes in this slice.

In parallel, pin the Galaxio appearance oracle and test an exterior Milky Way image bank. The observer and visual-prototype lanes meet at one integrated solar-to-galaxy flight. Planet completion gates legacy retirement, not the first galaxy proof.

## Audit evidence and limits

Representative evidence, rather than one node per file:

- Duplicate behavior: `src/platform/{camera-math,sphere-drag,scene-lifetime}.mjs`, `packages/engine/src/{navigation,runtime}`, `site/scene-router.mjs`.
- Upward imports/providers: `src/platform/object-runtime-contract.mjs`, `tools/objects/{celestial/adapters,geometry-adapters}.ts`, `src/renderers/css/preparation/presentation/adapters.ts`.
- Raster/CSS seam: `src/preparation/raster/index.ts`, `src/renderers/css/preparation/materials/lighting.ts`.
- Build/guard ownership: `tools/package-boundaries.test.mjs`, `src/renderers/css/{tsconfig.json,tsup.config.ts}`, `tools/objects/{tsconfig.json,tsup.config.ts}`.
- World/recipe limits: `src/renderers/css/navigation/{world-camera,saved-world-camera}.ts`, `packages/engine/src/runtime/selection-flight.ts`, `packages/objects/src/authored.ts`, `site/objects.mjs`.
- Galaxio reference: `packages/astronomy/src/frames.ts`, `packages/engine/src/camera/cameraRig.ts`, `scene/{solarSystemScene,renderAltitude,tierWeights}.ts`, `deepsky/{galaxyData,deepSkyPointIdentity,dsoObjectData}.ts`, `stars/starField.ts`, `scene/volumeRaymarch.ts`, plus its catalog builders and load dispatch.

The inventory covers tracked modules; the diagrams will summarize selected dependency chains, including manually inspected dynamic adapters. Generated planet payloads were excluded from import parsing. We studied frame/camera, scale policy, loading, identity, preparation and renderer boundaries; we did not benchmark universe rendering, review every shader, audit every legacy object or investigate terrain/spacecraft in depth.

Current package boundary tests pass (4/4), and preparation typechecking passes. Proposed universe acceptance gates above have not been implemented or run. No migration was performed as part of this architecture review.

Independent review was attempted with two external vendors. One was quota-blocked and the other timed out without a verdict; neither attempt is counted as a completed review. The three specialist code audits and the synthesis are complete.

## Visual decision map

Open [the eight diagrams](universe-options.html) for current dependencies, three alternative paths, target ownership, scale representations, the Milky Way pipeline and billboard choices. Default light style was approved.

- **A — foundation first:** clean shared integration before galaxy work; visual uncertainty is discovered later.
- **B — Milky Way proof first:** quickest isolated visual comparison; shared migration and seamless navigation are deferred.
- **C — combined (recommended):** a stable compatibility seam allows anchored-world and prepared-galaxy work in parallel; alowpoly independently migrates planet detail.

For the Milky Way, compare a multiview exterior image bank to a single billboard baseline. Add depth sprites only if the required camera movement needs parallax. Galaxio integrates emission and extinction; ordinary CSS alpha layers are not a general substitute. Start with one specified exterior camera orbit and held-out midpoint views. The bank’s decoded bytes, frame time and image errors must be measured before expanding coverage.

The existing photographic cubes combine Milky Way light, nebulae and faint stars; bright retained catalog points are separate. A new galaxy layer must replace the whole photographic context or use newly separated prepared background assets. Fading bright points alone leaves the old Milky Way visible.
