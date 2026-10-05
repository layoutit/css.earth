# Proposed site architecture

**Recommend option 3: relocate queued loader functions to their owners.** This draft requires owner and alowpoly sign-off before S3. S2 changes only the plan and checker; it moves no application files. The projection proves connectivity, not runtime behavior or generated chunk bytes.

[moves.json](site-architecture/moves.json) records destinations; [tiers.json](site-architecture/tiers.json) records layers, denies and draft policy; [edits.json](site-architecture/edits.json) records the recommended semantic changes; [loader-options.json](site-architecture/loader-options.json) records alternatives; [references.json](site-architecture/references.json) is a compact path-and-class inventory.

## Folder ownership

A folder imports itself or strictly lower layers. Sibling folders, including L0 siblings, cannot import each other. Value, lazy, type, CSS and JSON edges all count. Tests are leaf consumers above production. There are no lateral allowances. For a legitimate new sibling edge, re-derive longest-path levels for the production DAG and regenerate all tables; a cycle requires an ownership change, not a tier exemption.

<!-- generated:folders -->
| Tier | Folder | Purpose | Final files | Incoming moves |
| ---: | --- | --- | ---: | --- |
| 0 | `browser/` | Browser input, DOM and serialized import queue | 17 | 15; `runtime-policy.mts`, `diagnostics-policy.mts`, `in-flight-loader.mts`, `next-frame.mts` |
| 0 | `model/` | Object identities, routes and held addresses | 8 | 7; `navigation/system-address.mts`, `root-object.mts`, `orbit-root.mts`, `planetary-system-members.mts` |
| 0 | `overview/` | Prepared spectral overview readers | 4 | 2 |
| 0 | `prepared/` | Prepared transports and generated inputs | 25 | 24; `prepared-catalogue.d.mts`, `prepared-navigation-markers.d.mts`, `prepared-object-path.mts`, `prepared-shell-icons.d.mts` |
| 0 | `source/` | Preserved input records and artwork | 60 | 0 |
| 0 | `vendor/` | Preserved third-party notices | 1 | 0 |
| 0 | `server-assets/` | Server and build prepared-asset origin | 1 | 1; `asset-origin.mts` |
| 0 | `contracts/` | Shared page and shell interfaces | 3 | 3; `object-shell-types.ts`, `object-page-contract.mts` |
| 1 | `directory/` | Startup reads and object catalogue directory | 10 | 9; `startup-world.mts`, `startup-requests.mts`, `object-entries.mts`, `object-directory.mts` |
| 1 | `minimap/` | Surface-map measurements and view formatting | 7 | 4 |
| 2 | `world/` | Shared framing, visibility and camera context | 54 | 53; `world-objects.mts`, `world-system-views.mts`, `context-availability.mts`, `context-datasets.mts` |
| 3 | `content/` | Card content, citations and metadata | 21 | 20; `dataset-content.mts`, `dataset-context.mts`, `object-text.mts`, `prepared-panel-content.mts` |
| 3 | `navigation/` | History, requests, flights and arrivals | 34 | 22; `prepared-arrival.mts`, `prepared-scene-ownership.mts`, `arrival-billboard.mts`, `prepared-world-navigation.mts` |
| 4 | `search/` | Catalogue search and result presentation | 17 | 6 |
| 4 | `selection/` | Committed selection and camera handovers | 6 | 6; `scene/scene-selection.mts`, `satellite-selection.mts`, `overview-selection.mts`, `showcase.mts` |
| 5 | `shell/` | Retained shell controls and panels | 27 | 20; `object-browser.mts`, `feature-browser.mts`, `destination-browser.mts`, `selection-presentation.mts` |
| 6 | `server/` | SSR readers, responses and host middleware | 30 | 17; `object-page-data.mts`, `first-view-transport.mts`, `object-entry.mts`, `world-places.mts` |
| 6 | `scene/` | Scene sessions, replacement and publication | 26 | 11; `object-adapter.mts`, `packaged-object-runtime.mts`, `startup-billboard.mts`, `initial-scene.mts` |
| 7 | `startup/` | Page boot helpers and router entry | 7 | 7; `shared-imports.mts`, `startup-boot.mts`, `startup-cover.mts`, `initial-shell-context.mts` |
| 7 | `build/` | Site preparation and packaging | 82 | 31; `prepare-body-moons.mts` |
| 8 | `layouts/` | Shared page frame and its styles | 7 | 5; `components/ObjectSwatchStyles.astro`, `site.css`, `object-shell.css`, `wordmark.css` |
| 9 | `components/` | Reusable Astro markup and SSR composition | 29 | 0 |
| 10 | `pages/` | Routes and object-page entries | 20 | 0 |
| 11 | `journeys/` | Cross-cutting journeys and support | 19 | 19 |
| 11 | `test/` | Retired test folder; no final occupants | 0 | 0 |
<!-- /generated:folders -->

The table is the final layering. Directory owns startup requests, startup world reads, object entries, registry and world context plan: it is the lower world family. World owns framing, visibility, datasets and camera context. History and fragments belong to navigation. The model's held-address reader carries its WeakMap and registration/disposal state; history keeps its re-export.

Startup is the page-boot root. Startup cover, initial shell context, error reporting and analytics are used only by ObjectLayout and belong there. Browser retains shared input/DOM primitives and the import queue. Server-assets owns the node-dependent asset-origin reader used by server and build; clients may not enter it. ObjectSwatchStyles moves beside its layout; ObjectPage stays in components. The layout module-script body stays in ObjectLayout: extraction is unnecessary.

Server/search-response deliberately shares shell/selection-presentation and selection/scene-selection with the client. These operate on its supplied server document and selection values; they are shared presentation/selection logic, not browser entry points. This is an explicit permitted downward dependency, not a general server-to-client isolation claim. Client owners cannot import server, build or server-assets. Layouts/components/pages cannot import build. Only layouts and pages may enter startup.

Registry types live in directory, navigation types in navigation and presenter types in scene. Their declared imports model implementation dependencies; adding an edge cannot establish necessity.

## Draft workflow

The draft deadline is **2026-11-02**, inclusive. The owner may extend draftUntil explicitly in tiers.json before expiry. Until then a plan finding is a warning: the check prints it with the fix command and, in GitHub Actions, as an annotation, and a contributor's PR is not blocked (the check stops at the first finding, so the ceiling `warningCeiling: 1` allows exactly that one warning). After the deadline every plan finding fails. Existing scanner/rule failures always fail. Strict --accept always fails on findings.

When an unsigned plan drifts, update its destination/semantic edits and regenerate it. Do not reshape application behavior solely to silence a draft. Sign-off changes status from draft to enforced. Every mapped path is checked for existence, including deleted mapped files; generated inputs are explicit exceptions. Routine checks rescan the compact inventory so stale references fail rather than persist invisibly.

## S3 atomic changes

The changes array partitions stable edit ids into atomic groups. All seven groups are necessary by removal projection. **Minimality holds at group level only**: individual modelling imports can be removable. Groups currently commute; the listed order is a tested replay, not a claim that another order must fail. Added modules are placed at root during S3, where destination folders may not yet exist; S4 moves them with their owners. The L6 null moves are deletion preconditions.

<!-- generated:changes -->
| Tier | Change / PR | Edit ids | Required code change |
| ---: | --- | --- | --- |
| 0 | Extract held address reader | add-file-navigation-href, add-import-navigation-history-navigation-href, retarget-application-world-resources-navigation-href | Move navigationHref AND its owners WeakMap. Export a registration function for history; preserve deferred URL semantics. History registers and unregisters its held address reader in the same WeakMap; re-export the getter for existing navigation callers. Only lower world caller uses navigationHref; other callers retain history behavior. |
| 1 | Extract registry types | add-file-object-entry-types, retarget-object-directory-object-entry-types, add-import-objects-object-entry-types | Extract registry aliases from objects; directory must not import the registry that calls it. Use the extracted registry aliases without evaluating the full registry. Registry imports and re-exports its extracted aliases so clients can migrate without duplication. |
| 3 | Extract navigation contracts | add-file-navigation-types, retarget-prepared-arrival-navigation-types, retarget-navigation-history-navigation-types, add-import-prepared-world-navigation-navigation-types, add-import-navigation-request-navigation-types | Own WorldHandoff, NavigationHistory and NavigationIntent beside navigation. Import MountOptions, ObjectSceneLifecycle, ObjectWorldNavigation, SceneSubject and PageView; preserve erased aliases SceneView and SelectionTarget. Arrival reads WorldHandoff from the lower contract; navigation still owns flights. Extract NavigationHistory and NavigationIntent into navigation-types; the history transport must not import request orchestration. Flights import and re-export the extracted WorldHandoff contract. Request imports its extracted intent and history types and the plain selection shape; selection behavior is passed in. |
| 3 | Split the moon catalogue reader | add-file-moon-catalogue, retarget-object-children-moon-catalogue, remove-import-prepare-body-moons-moon-catalogues, add-import-prepare-body-moons-moon-catalogue | Split catalogue parsing, cached source catalogue and catalogueMoons into a runtime-safe reader; preparation keeps search-based ordering. Read catalogueMoons from the split reader; production must never import build preparation. Move the source catalogue import with its parser into the reader; preparation calls that reader. Use the single catalogue reader for preparation too; preserve the named-moon eligibility policy in preparation. |
| 3 | Pass selection into navigation requests | remove-import-navigation-request-scene-selection, add-import-navigation-request-scene-subject | Pass selectionTargetFromUrl explicitly through resolveNavigation and readNavigationSelection. Router uses the existing registry export, injects it into createSceneActivation, which forwards all three calls. Import erased SceneView/SelectionTarget aliases from navigation-types; never retain the selection import. Keep existing subject identity helpers in the lower world owner; pass selectionTargetFromUrl as a parameter. |
| 6 | Extract the frame presenter contract | add-file-scene-frame-presenter, retarget-scene-session-scene-frame-presenter, add-import-scene-world-scene-frame-presenter | Extract the structural presenter interface; a session must not import the world coordinator that consumes it. Session reads SceneFramePresenter from the lower contract, breaking the two-way type dependency. World coordinator imports and re-exports the structural presenter contract. |
| 0 | Relocate queued loader owners | add-file-scene-imports, add-file-world-imports, remove-queue-runtime, remove-shared-registry, remove-shared-world, retarget-adapter-scene-imports, retarget-router-world-imports, add-router-scene-imports, remove-directory-queue, retarget-boot-scene-imports, add-boot-world-imports | Own queued registry and packaged-runtime functions in scene; share browser queuedImport and its single last chain. Own the queued application-world import in world; no initializer inside the thunk. Move the runtime function out of the import-free browser queue implementation. Leave only importSceneRouter in startup/shared-imports. Move the world function to its owner. Adapter directly uses the same queued runtime function; preserve the frozen default adapter. Split router loader imports; preserve module-evaluation autostart. Import registry/runtime functions and register only the directory runtime loader using the existing object-directory import before first scene call. Directory accepts a typed runtime-loader registration; read the slot at scene invocation, not metadata construction. Missing registration fails explicitly. Body prestart and registry prestart reuse scene-owned promises. View prestart reuses the world-owned promise. |
<!-- /generated:changes -->

## Recommended loader design: option 3

Read sources: site/import-queue.mts:13–26, site/shared-imports.mts:1–7, site/startup-boot.mts:1–24, site/layouts/ObjectLayout.astro:162–178, site/object-directory.mts:55–72, site/object-adapter.mts:1–20 and site/scene/scene-router.mts:839–845.

```text
layout → startup/shared-imports → queued router import (module autostart)
       → startup/startup-boot   → scene/scene-imports → registry/runtime
                               → world/world-imports → application world
                                  all loaders → browser/import-queue
router → directory runtime-loader registration → first scene call
```

- Move queuedImport and its **single last chain** to browser/import-queue. Keep its pending sharing and rejection-reset semantics unchanged. It has no imports of scene/runtime modules.
- Scene/scene-imports owns importSceneRegistry and importPackagedObjectRuntime. World/world-imports owns importApplicationWorld. Each function still wraps only import(), using the same queuedImport. Startup/shared-imports keeps only importSceneRouter; startup-boot imports scene/world loaders directly.
- Router imports scene/world loader modules. Its existing object-directory import registers only the directory runtime loader before any scene call, then runs the existing module-evaluation autostart. The adapter directly imports scene/scene-imports; its frozen default remains intact. No factory or .then(start) is introduced.
- Directory exports a typed registration function. It reads the configured loader at scene invocation, never during objectFromEntry or registry construction. Missing registration fails clearly. Metadata callers in build, Astro SSR and server endpoints remain valid without a loader. System-host recursion, abort signals, retry and entry identity must remain identical.
- Root-level scene-imports/world-imports exist during S3; imports point at current paths until S4. No thunk awaits a queued function behind itself. The router's rejection remains a module-evaluation failure with the existing retry behavior and layout failure cleanup.

S3 must prove one shared queue chain, registration before the first scene call, metadata construction without registration, registration/retry/abort behavior, and queue settlement/error cleanup by tests with mutations. Compare entry-chunk module membership and bytes: the predicted additions are exactly the two tiny scene/world loader modules containing import() calls. This is an inference until an actual build comparison proves it. Reuse of functions does not prove unchanged bytes.

## Loader alternatives

1. **Import-free directory slot**, registered by the existing layout startup script before importSceneRouter (or a new startup/main if separately justified). Move loader implementations to startup and let router/adapter/directory read typed slot functions. It can preserve module autostart and downward edges; DI in general is not an impasse. The graph variant is recorded in loader-options.json. It is not recommended because it adds page-owned registration of registry/world/runtime plus use-time proxies across three consumers, where option 3 needs only directory registration and keeps function ownership beside their modules. It would require slot-before-import mutation tests and entry-chunk measurements; no S2 behavioral proof exists.
2. **Queued .then(start) DI**: pass loaders into a router initializer and adapter factory. Queue settlement may follow synchronous start, but module-evaluation phase differs, a retry can start twice, and any await of another queued loader inside start can deadlock. Prove these separately; a graph pass is not an equivalent-startup proof. This variant is not selected.
3. **Lazy-boundary exception**: preserve current service imports and explicitly exempt only the directory/adapter/router upward loader edges. Report service SCCs separately. This preserves current startup behavior but abandons the zero-cycle acceptance claim and requires changed rules; it is not selected.

## Other S3 risks

- Moon catalogue split changes build/SSR chunk membership, checkObjectTree timing and client bytes from the source parsers. The single reader owns parsing/cache/catalogueMoons; preparation retains search ordering and eligibility. Compare outputs, errors, timing and chunks before S3.
- Selection is passed into navigation requests. Router and activation must forward the registry function on all three readNavigationSelection calls. Test the **default production URL path** and mutation-remove its wiring; passing a non-default callback that routes around the defect is insufficient.
- Type-owner extractions must preserve aliases and re-exports. The held-address extraction must preserve deferred reads and disposal in the same WeakMap.

## Generated delivery and S4 gates

Declarations use **git ls-files only**. Ignored outputs resolve to their declared paths, with tracked sibling .d.mts stand-ins for generated modules. The snapshot must match in a clean checkout, a restored checkout and CI. The four tracked declarations move beside their ignored modules. Restore object prepared inputs with pnpm setup:prepared; generate all ignored site inputs locally with pnpm build:prepare (including prepare:inputs, prepare:world-presentation, prepare:shell-assets and prepare:object-json) when running application/build proofs; neither is needed for plan acceptance. S2 publishes nothing.

Update producers and readers together: site prepare-catalog, shell-icons/titles, moon-labels, world-presentation, facilities and feature-index; packages/bake navigation preparation and dataset billboards. Preserve published addresses. Move the four layout CSS files with their style imports. Also update ignores and declaration/template identities.

S3 replays current locations with root-level additions. File SCCs cannot increase, folder SCCs must remain contained in the baseline, and the final S3 prefix must have zero file SCCs. S3 tier counts are n/a because current folders are not final layers. S4's synthetic top-tier legacy replay is a **corollary of the final DAG**, not an independent proof: moving folders in tier order cannot fail when the final projection passes. S4's real risks are references and executed-test identities.

<!-- generated:sequence -->
| Phase | Step | File SCCs | Folder SCCs | Upward | Lateral | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| S3 | extract-held-address-reader | 4 | 2 | n/a | n/a | pass |
| S3 | extract-registry-types | 4 | 2 | n/a | n/a | pass |
| S3 | extract-navigation-contracts | 3 | 2 | n/a | n/a | pass |
| S3 | split-the-moon-catalogue-reader | 3 | 2 | n/a | n/a | pass |
| S3 | pass-selection-into-navigation-requests | 3 | 2 | n/a | n/a | pass |
| S3 | extract-the-frame-presenter-contract | 2 | 2 | n/a | n/a | pass |
| S3 | relocate-queued-loader-owners | 0 | 2 | n/a | n/a | pass |
| S4 | site/browser | 0 | 0 | 0 | 0 | pass |
| S4 | site/contracts | 0 | 0 | 0 | 0 | pass |
| S4 | site/model | 0 | 0 | 0 | 0 | pass |
| S4 | site/overview | 0 | 0 | 0 | 0 | pass |
| S4 | site/prepared | 0 | 0 | 0 | 0 | pass |
| S4 | site/server-assets | 0 | 0 | 0 | 0 | pass |
| S4 | site/source | 0 | 0 | 0 | 0 | pass |
| S4 | site/vendor | 0 | 0 | 0 | 0 | pass |
| S4 | site/directory | 0 | 0 | 0 | 0 | pass |
| S4 | site/minimap | 0 | 0 | 0 | 0 | pass |
| S4 | site/world | 0 | 0 | 0 | 0 | pass |
| S4 | site/content | 0 | 0 | 0 | 0 | pass |
| S4 | site/navigation | 0 | 0 | 0 | 0 | pass |
| S4 | site/search | 0 | 0 | 0 | 0 | pass |
| S4 | site/selection | 0 | 0 | 0 | 0 | pass |
| S4 | site/shell | 0 | 0 | 0 | 0 | pass |
| S4 | site/scene | 0 | 0 | 0 | 0 | pass |
| S4 | site/server | 0 | 0 | 0 | 0 | pass |
| S4 | site/build | 0 | 0 | 0 | 0 | pass |
| S4 | site/startup | 0 | 0 | 0 | 0 | pass |
| S4 | site/layouts | 0 | 0 | 0 | 0 | pass |
| S4 | site/components | 0 | 0 | 0 | 0 | pass |
| S4 | site/pages | 0 | 0 | 0 | 0 | pass |
| S4 | site/journeys | 0 | 0 | 0 | 0 | pass |
| S4 | site/test | 0 | 0 | 0 | 0 | pass |
<!-- /generated:sequence -->

The reference scan covers full/extensionless/relative file strings plus the retired site/test/ folder prefix, including site/test/** and site/test/* globs. It does not prove arbitrary computed paths or every possible folder spelling. Plan-internal inventories and plan-checker implementation files are excluded. Generated tables exclude themselves. Dated history stays separate from live references. Full line-numbered output exists only on demand with --references; it is not committed.

<!-- generated:references -->
| Scope and class | Path/class pairs |
| --- | ---: |
| live: AGENTS.md contract text | 4 |
| live: CI routing | 1 |
| live: Python script | 2 |
| live: computed import | 2 |
| live: docs code-span | 21 |
| live: docs link | 26 |
| live: generator/producer literal | 96 |
| live: source import | 236 |
| live: tsconfig/eslint/package.json | 20 |
| live: workflow | 3 |
| plan: docs code-span | 1 |
<!-- /generated:references -->

Before **every moved-test PR**, capture the actual executed test-file list. After the move, require every old test's mapped destination in the executed list, with no lost identity. Check both local wiring and each affected CI command. Node 22 may exit zero for a no-match glob alongside valid files; an exit code alone is insufficient.

Required reference updates include:

- .github/workflows/audit.yml:180,182 source/facility globs; universe.yml:66 sparse checkout prefix; eslint.config.mts:167,175 test/helper exclusions.
- docs/sources-catalogue.md:117; src/objects/README.md:37; packages/bake/AGENTS.md:117,126 folder guidance and its stale prepare-body-overview path (actual caller is site/build/charts/charts.ts).
- labs/investigations/capture-galaxies.mts:10 fixture output; typescript ownership and nebula inbound prefix checks; site tsconfigs, lint selectors, preload, rendered routes, affected-test wiring, directory growth baseline and CI areas.
- Root/object/bake contracts and outside-site producers/imports. Inspect computed import/read producers during each move. Compare actual typechecked files so tests/helpers do not silently enter production lint/typecheck policy.

<!-- generated:relative-reads -->
| Test with depth-sensitive reads | Destination |
| --- | --- |
| site/test/arrival-discovery.test.mts | site/build/prepare/arrival-discovery.test.mts |
| site/test/body-additions.test.mts | site/build/prepare/body-additions.test.mts |
| site/test/category-frames.test.mts | site/build/prepare/category-frames.test.mts |
| site/test/compact-spectrum.test.mts | site/overview/compact-spectrum.test.mts |
| site/test/dataset-response.test.mts | site/server/dataset-response.test.mts |
| site/test/folded-transit.test.mts | site/build/charts/folded-transit.test.mts |
| site/test/hosted-banks.test.mts | site/build/prepare/hosted-banks.test.mts |
| site/test/load-object-content.mts | site/build/content/load-object-content.test-support.mts |
| site/test/lonlat-slice-table.test.mts | site/build/prepare/lonlat-slice-table.test.mts |
| site/test/moon-labels.test.mts | site/world/moon-labels.test.mts |
| site/test/neutral-catalogue-color.test.mts | site/journeys/neutral-catalogue-color.test.mts |
| site/test/object-page-data.test.mts | site/server/object-page-data.test.mts |
| site/test/object-systems.test.mts | site/world/object-systems.test.mts |
| site/test/prepare-spatial-context.test.mts | site/build/prepare/prepare-spatial-context.test.mts |
| site/test/prepared-panel-content.test.mts | site/content/prepared-panel-content.test.mts |
| site/test/prepared-world-context.test.ts | site/world/prepared-world-context.test.ts |
| site/test/satellite-arrival-framing.test.mts | site/navigation/satellite-arrival-framing.test.mts |
| site/test/scene-contract.test.mts | site/world/scene-contract.test.mts |
| site/test/system-framing.test.mts | site/world/system-framing.test.mts |
| site/test/system-text.test.mts | site/build/prepare/system-text.test.mts |
| site/test/system-view-file.mts | site/world/system-view-file.test-support.mts |
| site/test/world-billboards.test.mts | site/journeys/world-billboards.test.mts |
| site/test/world-stars.test.mts | site/world/world-stars.test.mts |
| site/test/world-tables.test.mts | site/world/world-tables.test.mts |
| site/test/zoom-scope.test.mts | site/world/zoom-scope.test.mts |
<!-- /generated:relative-reads -->

Move PRs delete applied mappings/groups, retarget pending edits and regenerate tables. The --references --old gate fails live old-file references and also prints covering folder/glob references for review. During partial moves, old globs may still serve remaining tests: extend wiring for the moved tests and prove executed identities. Once the folder is retired, run --references --old site/test/ and require zero live folder/glob references. Both gates work after removing applied map entries.

## Executable projection

<!-- generated:numbers -->
| View | Before file SCCs | Before folder SCCs | Before upward | Before lateral | After file SCCs | After folder SCCs | After upward | After lateral |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| value | 0 | 2 | 30 | 10 | 0 | 0 | 0 | 0 |
| value+lazy | 2 | 2 | 32 | 11 | 0 | 0 | 0 | 0 |
| value+lazy+type | 4 | 2 | 43 | 24 | 0 | 0 | 0 | 0 |
| all | 4 | 2 | 43 | 26 | 0 | 0 | 0 | 0 |

Unassigned files: before 0; after 0. No lateral allowances.
Identity uses the proposed numbers on existing folders and tier zero for loose root files. It applies no moves or edits.
<!-- /generated:numbers -->

Counts represent declarations and cyclic components. External package boundaries remain under the ordinary architecture rules. Acceptance scans live tracked declarations and live compact references; it requires no ignored snapshot. No independent review is claimed unless a completed cited report exists.

Commands from a clean checkout:

```sh
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
pnpm install --frozen-lockfile
node --test .github/scripts/architecture/*.test.mts .github/scripts/audits/check-documentation-links.test.mts
node .github/scripts/architecture/site-architecture.mts --accept
node .github/scripts/architecture/site-architecture.mts --identity
node .github/scripts/architecture/site-architecture.mts --sequence
node .github/scripts/architecture/site-architecture.mts --minimality
node .github/scripts/architecture/site-architecture.mts --references > /tmp/site-architecture-references.json
pnpm check:architecture
# When changing plan data, regenerate first, then rerun acceptance:
node .github/scripts/architecture/site-architecture.mts --write
node .github/scripts/architecture/site-architecture.mts --accept
# Per-move gate: substitute that PR's actual old paths; fails before migration.
node .github/scripts/architecture/site-architecture.mts --references --old site/test/source-link.test.mts
```

## Owner decisions

- Approve recommended option 3, or select a documented loader alternative and its different proofs.
- Approve page-boot helpers in startup and the final layer ownership.
- Sign off by November 2, or explicitly extend draftUntil; name the real-iPad startup-proof owner.
- Coordinate alowpoly's S3/S4 timing with performance branches touching scene-router, startup-boot and ObjectLayout.
