# Site architecture plan

**Option 3 was decided by the owner on 2026-10-05: relocate queued loader functions to their owners.** The router starts at module evaluation exactly as today, and all loading uses the same single serialized queue chain. S2 changes only documentation and tools; it moves no application files. The projection proves connectivity, not runtime behavior or generated chunk bytes. This PR is ready for the owner to merge.

[moves.json](site-architecture/moves.json) records destinations; [tiers.json](site-architecture/tiers.json) records layers, denies and planned/enforced status; [edits.json](site-architecture/edits.json) records the decided semantic changes. Only structural tables are committed here (the folders and the S3 changes); counts that move with every ordinary import are printed by `--tables` and written to the CI job summary.

## Folder ownership

A folder imports itself or strictly lower layers. Sibling folders, including L0 siblings, cannot import each other. Value, lazy, type, CSS and JSON edges all count. Tests are leaf consumers above production. There are no lateral allowances. For a legitimate new sibling edge, re-derive longest-path levels for the production DAG and regenerate all tables; a cycle requires an ownership change, not a tier exemption.

<!-- generated:folders -->
| Tier | Folder | Purpose | Incoming moves |
| ---: | --- | --- | --- |
| 0 | `browser/` | Browser input, DOM and serialized import queue | 2; `import-queue.mts` |
| 0 | `model/` | Object identities, routes and held addresses | 0 |
| 0 | `overview/` | Prepared spectral overview readers | 1 |
| 0 | `prepared/` | Prepared transports and generated inputs | 23; `prepared-catalogue.d.mts`, `prepared-navigation-markers.d.mts`, `prepared-shell-icons.d.mts`, `prepared-shell-titles.d.mts` |
| 0 | `source/` | Preserved input records and artwork | 0 |
| 0 | `vendor/` | Preserved third-party notices | 0 |
| 0 | `server-assets/` | Server and build prepared-asset origin | 0 |
| 0 | `contracts/` | Shared page and shell interfaces | 0 |
| 1 | `directory/` | Startup reads and object catalogue directory | 9; `startup-world.mts`, `object-directory.mts`, `objects.mts`, `world-context-plan.mts` |
| 1 | `minimap/` | Surface-map measurements and view formatting | 0 |
| 2 | `world/` | Shared framing, visibility and camera context | 52; `world-objects.mts`, `world-system-views.mts`, `stellar-extents.mts`, `hosted-banks.mts` |
| 3 | `content/` | Card content, citations and metadata | 13; `exploration-catalog.mts`, `source-documentation.mts`, `seo.mts`, `seo-trail.mts` |
| 3 | `navigation/` | History, requests, flights and arrivals | 10; `prepared-arrival.mts`, `prepared-world-navigation.mts` |
| 4 | `search/` | Catalogue search and result presentation | 0 |
| 4 | `selection/` | Committed selection and camera handovers | 8; `scene/scene-selection.mts`, `satellite-selection.mts`, `overview-selection.mts`, `showcase.mts` |
| 5 | `shell/` | Retained shell controls and panels | 14; `object-browser.mts`, `feature-browser.mts`, `destination-browser.mts`, `selection-presentation.mts` |
| 6 | `server/` | SSR readers, responses and host middleware | 8; `object-entry.mts`, `world-places.mts`, `dot-catalogue-data.mts`, `social-images.mts` |
| 6 | `scene/` | Scene sessions, replacement and publication | 8; `object-adapter.mts`, `packaged-object-runtime.mts`, `startup-billboard.mts` |
| 7 | `startup/` | Page boot helpers and router entry | 5; `shared-imports.mts`, `startup-boot.mts` |
| 7 | `build/` | Site preparation and packaging | 8; `prepare-body-moons.mts` |
| 8 | `layouts/` | Shared page frame and its styles | 2; `components/ObjectSwatchStyles.astro`, `object-shell.css` |
| 9 | `components/` | Reusable Astro markup and SSR composition | 0 |
| 10 | `pages/` | Routes and object-page entries | 0 |
| 11 | `journeys/` | Cross-cutting journeys and support | 1 |
| 11 | `test/` | Retired test folder; no final occupants | 0 |
<!-- /generated:folders -->

The table is the final layering. Directory owns startup requests, startup world reads, object entries, registry and world context plan: it is the lower world family. World owns framing, visibility, datasets and camera context. History and fragments belong to navigation. The model's held-address reader carries its WeakMap and registration/disposal state; history keeps its re-export.

Startup is the page-boot root. Startup cover, initial shell context, error reporting and analytics are used only by ObjectLayout and belong there. Browser retains shared input/DOM primitives and the import queue. Server-assets owns the node-dependent asset-origin reader used by server and build; clients may not enter it. ObjectSwatchStyles moves beside its layout; ObjectPage stays in components. The layout module-script body stays in ObjectLayout: extraction is unnecessary.

Server/search-response deliberately shares shell/selection-presentation and selection/scene-selection with the client. These operate on its supplied server document and selection values; they are shared presentation/selection logic, not browser entry points. This is an explicit permitted downward dependency, not a general server-to-client isolation claim. Client owners cannot import server, build or server-assets. Layouts/components/pages cannot import build. Only layouts and pages may enter startup.

Registry types live in directory, navigation types in navigation and presenter types in scene. Their declared imports model implementation dependencies; adding an edge cannot establish necessity.

## Contributor workflow

There is no deadline. With `status: "planned"`, a plan finding is a WARNING with the fix command and a GitHub Actions annotation; it never fails `pnpm check:architecture`. The check reports the first plan finding. With `status: "enforced"`, every plan finding fails. The owner changes the status when S4 ends. Existing architecture rules and scanner failures always fail. Strict `--accept` always fails on plan findings. Stale generated tables are the exception to the warning: `pnpm check:architecture` fails whenever the committed folder and change tables differ from what `--write` would produce, in either status. They change only with `moves.json`, `tiers.json` or `edits.json`, so an ordinary pull request that adds an import never touches this document.

When a warning names your file, update its destination or semantic edits and run `node .github/scripts/architecture/site-architecture.mts --write`, then strict `--accept`. Do not change application behavior just to silence a plan warning. Every mapped path is checked for existence, including deleted mapped files; generated inputs are explicit exceptions. Routine checks rescan the compact inventory so stale references produce findings.

## S3 atomic changes

The changes array partitions stable edit ids into atomic groups. All seven groups are necessary by removal projection. **Minimality holds at group level only**: individual modelling imports can be removable. Groups currently commute; the listed order is a tested replay, not a claim that another order must fail. Added modules are placed at root during S3, where destination folders may not yet exist; S4 moves them with their owners. The L6 null moves are deletion preconditions.

<!-- generated:changes -->
| Tier | Change / PR | Edit ids | Required code change |
| ---: | --- | --- | --- |
| 0 | Extract held address reader | add-file-navigation-href, add-import-navigation-history-navigation-href, retarget-application-world-resources-navigation-href | Move navigationHref AND its owners WeakMap. Export a registration function for history; preserve deferred URL semantics. History registers and unregisters its held address reader in the same WeakMap; re-export the getter for existing navigation callers. Only lower world caller uses navigationHref; other callers retain history behavior. |
| 0 | Relocate queued loader owners | add-file-scene-imports, add-file-world-imports, remove-queue-runtime, remove-shared-registry, remove-shared-world, retarget-adapter-scene-imports, retarget-router-world-imports, add-router-scene-imports, remove-directory-queue, retarget-boot-scene-imports, add-boot-world-imports | Decided by the owner: loader modules hold only import() calls through the existing queue. Own registry and packaged-runtime functions in scene; move the single last chain to lower browser/import-queue. Prove one queue chain, registration before the first scene call, the same entry-chunk modules and bytes, identical L1/L2/L3, L7 no worse and the real-iPad startup journey. Own the queued application-world import in world; no initializer inside the thunk. Move the runtime function out of the import-free browser queue implementation. Leave only importSceneRouter in startup/shared-imports. Move the world function to its owner. Adapter directly uses the same queued runtime function; preserve the frozen default adapter. Split router loader imports; preserve module-evaluation autostart. Import registry/runtime functions and register only the directory runtime loader using the existing object-directory import before first scene call. Directory accepts a typed runtime-loader registration; read the slot at scene invocation, not metadata construction. Missing registration fails explicitly. Body prestart and registry prestart reuse scene-owned promises. View prestart reuses the world-owned promise. |
<!-- /generated:changes -->

## Decided loader design: option 3

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

S3 must prove one shared queue chain, registration before the first scene call, metadata construction without registration, registration/retry/abort behavior, and queue settlement/error cleanup by tests with mutations. Require the same entry-chunk module membership and bytes, identical L1/L2/L3 results, L7 performance no worse, and the real-iPad startup journey (including delayed-summary cold loads). The extracted loader modules hold only import() calls through the shared queue; the single last chain lives in the lower browser module. These are S3 acceptance requirements, not results established by the S2 graph projection. Reuse of functions does not prove unchanged bytes. No functionality may break anywhere; performance must stay the same or improve. L7 is a performance guard beside the behavior checks.

## Options not taken

Parameter injection with a changed router start changes the router's evaluation phase. An explicit lazy-boundary exception gives up the zero-cycle claim. Neither is part of the plan.

## Other S3 risks

- **Chunk layout is a constraint.** The performance guard fails any rise in raw, gzip or Brotli bytes, request counts, chain lengths or preloads. A real graph edit that moved the registry into the router chunk lowered raw bytes by 57 and raised gzip by 55 and Brotli by 145, so it fails. S3's loader change must keep the existing chunk assignment (pin it), or show every compressed size at or below the baseline.
- Moon catalogue split changes build/SSR chunk membership, checkObjectTree timing and client bytes from the source parsers. The single reader owns parsing/cache/catalogueMoons; preparation retains search ordering and eligibility. Compare outputs, errors, timing and chunks before S3.
- Selection is passed into navigation requests. Router and activation must forward the registry function on all three readNavigationSelection calls. Test the **default production URL path** and mutation-remove its wiring; passing a non-default callback that routes around the defect is insufficient.
- Type-owner extractions must preserve aliases and re-exports. The held-address extraction must preserve deferred reads and disposal in the same WeakMap.

## Generated delivery and S4 gates

Declarations use **git ls-files only**. Ignored outputs resolve to their declared paths, with tracked sibling .d.mts stand-ins for generated modules. The snapshot must match in a clean checkout, a restored checkout and CI. The four tracked declarations move beside their ignored modules. Restore object prepared inputs with pnpm setup:prepared; generate all ignored site inputs locally with pnpm build:prepare (including prepare:inputs, prepare:world-presentation, prepare:shell-assets and prepare:object-json) when running application/build proofs; neither is needed for plan acceptance. S2 publishes nothing.

Update producers and readers together: site prepare-catalog, shell-icons/titles, moon-labels, world-presentation, facilities and feature-index; packages/bake navigation preparation and dataset billboards. Preserve published addresses. Move the four layout CSS files with their style imports. Also update ignores and declaration/template identities.

S3 replays current locations with root-level additions. File SCCs cannot increase, folder SCCs must remain contained in the baseline, and the final S3 prefix must have zero file SCCs. S3 tier counts are n/a because current folders are not final layers. S4's synthetic top-tier legacy replay is a **corollary of the final DAG**, not an independent proof: moving folders in tier order cannot fail when the final projection passes. S4's real risks are references and executed-test identities.

The sequence table (one row per S3 and S4 step: file and folder SCCs, upward and lateral edges, result) is derived from the live import graph, so it is not committed. Print it with `node .github/scripts/architecture/site-architecture.mts --tables`; CI writes it to the job summary.

The reference scan covers full/extensionless/relative file strings plus the retired site/test/ folder prefix, including site/test/** and site/test/* globs. It does not prove arbitrary computed paths or every possible folder spelling. Plan-internal inventories and plan-checker implementation files are excluded. Generated tables exclude themselves. Dated history stays separate from live references. Full line-numbered output exists only on demand with --references; it is not committed.

The live reference counts by scope and class are derived on demand with `--tables`, or in full with `--references`.

Before **every moved-test PR**, capture the actual executed test-file list. After the move, require every old test's mapped destination in the executed list, with no lost identity. Check both local wiring and each affected CI command. Node 22 may exit zero for a no-match glob alongside valid files; an exit code alone is insufficient.

Required reference updates include:

- .github/workflows/audit.yml:180,182 source/facility globs; universe.yml:66 sparse checkout prefix; eslint.config.mts:167,175 test/helper exclusions.
- docs/sources-catalogue.md:117; src/objects/README.md:37; packages/bake/AGENTS.md:117,126 folder guidance and its stale prepare-body-overview path (actual caller is site/build/charts/charts.ts).
- labs/investigations/capture-galaxies.mts:10 fixture output; typescript ownership and nebula inbound prefix checks; site tsconfigs, lint selectors, preload, rendered routes, affected-test wiring, directory growth baseline and CI areas.
- Root/object/bake contracts and outside-site producers/imports. Inspect computed import/read producers during each move. Compare actual typechecked files so tests/helpers do not silently enter production lint/typecheck policy.

Tests with depth-sensitive relative reads are listed by `--tables`.

Move PRs delete applied mappings/groups, retarget pending edits and regenerate tables. The --references --old gate fails live old-file references and also prints covering folder/glob references for review. During partial moves, old globs may still serve remaining tests: extend wiring for the moved tests and prove executed identities. Once the folder is retired, run --references --old site/test/ and require zero live folder/glob references. Both gates work after removing applied map entries.

## Executable projection

The before and after projection numbers (file and folder SCCs, upward and lateral edges, unassigned files) are derived from the live import graph and printed by `--tables`; CI writes them to the job summary. No lateral allowances exist.

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
node .github/scripts/architecture/site-architecture.mts --tables
node .github/scripts/architecture/site-architecture.mts --references > /tmp/site-architecture-references.json
pnpm check:architecture
# When changing plan data, regenerate first, then rerun acceptance:
node .github/scripts/architecture/site-architecture.mts --write
node .github/scripts/architecture/site-architecture.mts --accept
# Per-move gate: substitute that PR's actual old paths; fails before migration.
node .github/scripts/architecture/site-architecture.mts --references --old site/test/source-link.test.mts
```

## Owner decisions and remaining ownership

- Option 3 and the final folder ownership, including page-boot helpers in startup, were decided by the owner.
- There is no deadline. The owner sets S4/S5 timing and changes planned to enforced when S4 ends.
- Branches touching scene-router, startup-boot and ObjectLayout are timed together so they do not collide.
- The real-iPad startup-proof device owner remains to be assigned.
