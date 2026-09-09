# TypeScript ownership

The package migration left duplicate JavaScript implementations of shared camera, drag and lifetime behavior, an unchecked shell, and preparation implementations described by handwritten declarations. This first ownership change consolidates five shared entry points behind checked TypeScript implementations and prevents the authored JavaScript backlog from growing unnoticed. It does not complete the application or preparation migration.

The source baseline is `main` at `1fb76e44d6bf831e7ebcf0516b83c0b10e1716da`. The [exact JavaScript inventory](typescript-ownership.json) records that source anchor and the remaining paths; it contains no timestamps or machine-specific build state.

## Owners established in this change

| Existing entry point | Implementation owner |
| --- | --- |
| `src/platform/camera-math.mjs` | `@cssearth/engine` camera math |
| `src/platform/sphere-drag.mjs` | `@cssearth/engine` trackball math |
| `src/platform/scene-lifetime.mjs` | Engine lifetime, plus renderer `runtime/scene-native-waits.ts` for browser paint/document waits |
| `site/runtime-policy.mjs` | `site/runtime-policy.mts` |
| `site/scene-contract.mjs` | `site/scene-contract.mts` |

The `.mjs` files remain compatibility entry points for existing Node, preparation, browser and source-test imports. The guard parses their ASTs and permits only the declared re-exports, so implementation code cannot accumulate in them. The renderer builds its browser wait helpers through its existing build configuration. The shell implementations use erasable `.mts` source, with a strict shell typecheck and runtime validation of incoming object content and scene lifecycles.

Node is now required to satisfy `^22.18.0 || >=24.0.0`. Native type stripping is enabled by default in Node 22.18, and `.mts` is always an ES module. Node executes these files without performing type checks; the separate `tsc` gates provide that check. The shell and ownership tool configurations reject TypeScript syntax requiring runtime transformation. See the [Node 22.18 TypeScript documentation](https://nodejs.org/download/release/v22.18.0/docs/api/typescript.html#type-stripping).

## Accountable JavaScript

The initial inventory after consolidation contains 1,950 JavaScript modules:

| Classification | Modules | Treatment |
| --- | ---: | --- |
| Authored implementation and preparation | 421 | Exact migration backlog; new paths fail |
| Tests, fixtures and browser/oracle harnesses | 1,482 | Separate test ownership; lower migration priority |
| Historical evidence harnesses | 31 | Individually inspected paths and reasons |
| Generated prepared output | 6 | Exact paths, generator provenance and source anchors |
| Preserved Cesium code | 3 | Exact paths, upstream/reproduction provenance and source anchors |
| Configuration boundaries | 2 | Exact existing Astro and ESLint configuration files |
| Compatibility facades | 5 | Exact AST-checked re-exports of typed owners |

Of the 421 authored modules, 255 are under `tools/`, 81 under `src/` (78 platform and three navigation), 52 under `site/`, 21 under `packages/`, and 12 under `docs/`. These counts describe source files, not compiled output or lines of code.

Names do not establish provenance. For example, `site/prepared-world-navigation.mjs` and `site/prepared-lens-legends.mjs` contain authored behavior and stay in the backlog. `src/platform/solar-geometry.mjs` is checked-in generator output. Source authoring, preparation and publication scripts under `docs/` also remain authored code; there is no blanket `docs/`, `prepared/` or `vendor/` exclusion.

The guard obtains tracked files plus untracked, nonignored files from Git and reads the current working tree. Tracked files remain accountable even if an ignore rule matches them; ignored build products are omitted. Deleting or migrating an implementation requires removing its exact backlog entry. Deleted exceptions also fail until removed. Generated/vendor entries require an existing provenance source and a matching source anchor, and new exceptions require an explicit reviewable reason.

Test classification follows `.test`/`.spec` names, `site/test/`, `tests/`, and `__fixtures__/`, with exact exceptions for two colocated renderer browser harnesses and five platform test fixtures/harnesses. The guard parses JS/TS modules and Astro frontmatter, client scripts and literal script sources, rejecting local imports or re-exports from implementation code into test/evidence modules. Resolution includes relative paths, Vite root URLs, the configured `public/` URL root, and `/@fs/` paths within this checkout. Commented imports do not count. This prevents ordinary imports from hiding production owners behind test paths; it is not a replacement for runtime/source closure checks or a proof of computed import targets.

## Running and updating the guard

```sh
pnpm check:typescript-ownership
pnpm test:typescript-ownership
pnpm typecheck
node tools/typescript-ownership.mts --json
```

The last command emits deterministic counts, classified paths and violations for inspection. It does not regenerate or expand the allowlist. A migration removes the completed paths from `legacyAuthored`; a necessary JavaScript exception names its exact file, reason and required provenance in `exceptions`. Keep the backlog sorted. Do not add a new authored implementation to the backlog to make the check pass.

The ownership tool has its own strict check, included in `pnpm typecheck`, and fixture tests exercise untracked/staged additions, removal after migration, excluded import boundaries, facade behavior, provenance, and tracked files matched by ignore rules. The shared universe workflow runs the ownership guard and tests alongside typechecking of packages, renderer, preparation and the migrated shell sources.

## Remaining migration

The shell gate checks the new `.mts` implementations, not the 52 remaining authored shell JavaScript modules. The existing root TypeScript configuration still does not establish whole-repository `checkJs` coverage. New shared shell work should extend the checked owner rather than another handwritten declaration.

Preparation is the largest remaining area. For example, [`prepare-authored.ts`](../../tools/objects/prepare-authored.ts) still dynamically loads the JS static-surface, material-composition and paged-ellipsoid implementations. [`material-composition/index.d.mts`](../../tools/objects/material-composition/index.d.mts) still uses `any` for its content callback. Those declarations describe callers' expectations; they do not typecheck the preparers. Migrate each implementation closure with its data validation and meaningful preparation tests, then remove its declarations and backlog paths.

This change preserves the generic object contract, single shared shell and retained prepared runtime. Package, source/runtime closure, router, renderer and `OBJECTS`-derived browser conformance checks still establish behavior. A passing ownership/typecheck gate alone does not prove a complete migration, prepared-asset reproduction, browser parity or merge readiness.

## Validation and current limits

The [validation receipt](typescript-ownership-validation.json) records the checked source hashes, exact commands, bounded browser result and independently reproduced base-commit failure. Validation used Node 24.19.0 and pnpm 10.33.0.

- Shared package, renderer and preparation builds pass. `pnpm exec astro build` compiles all 408 pages; this does not claim full prepared-asset assembly or deployment.
- The aggregate TypeScript gate passes, including the new strict browser-harness configuration.
- The focused helper/router/shell/content suite passes 106 tests; engine tests pass 48; package boundary tests pass four; the root command check passes.
- Chrome 152 verifies actual pointer capture and drag, two-frame startup completion, cancellation after the first native frame, release on destruction and no subsequent publications. It also observes the `.mts` policy import. Run `pnpm test:browser:typescript-owners http://127.0.0.1:4326` against a task-owned Astro dev server. This fixture is shared-helper integration, not object-scene conformance.
- The focused source-closure run passes three checks, including mutation rejection inside both `.mts` shell owners. The Sun-only case fails on a prepared source receipt that also fails on the unchanged base commit.

The broad shell attempt passed 288 and failed 14 before the preparation entrypoints were built. Those missing-entry failures were subsequently covered by passing focused reruns. The broad suite is still unqualified: the Sun receipt mismatch, absent pinned source/image files in this checkout, and Earth/Itokawa browser-profile requirements remain. The complete renderer/platform/preparation/all-object browser campaigns have not been run for this slice. Keep the PR draft until the required integrated gates are resolved and refreshed; none of these limitations is permission to weaken provenance or runtime validation.

The Sun mismatch is specific: `prepared/world-navigation.json` retains `580d8a568bf45f1b768641dd4707820042ed488cac78858d139de5bc66b69b7f` for the `world-context` source, while `object.json` and the actual `source/navigation/universe.json` use `c315ca0b52ced35cd557d3a0b0585cabfad9b6e38254e137edb15508358f206f`. The receipt frame itself matches. All six checked files, including the validator, are byte-identical to the base commit.

The only intentional behavior correction found during typing is error aggregation in responsive input policy: a non-Error throw (including `null`) plus a cleanup failure now retains both failures and the original cause, rather than failing while reading `error.message`.
