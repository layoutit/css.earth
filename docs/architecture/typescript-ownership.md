# TypeScript ownership

Application, preparation and source-authoring implementations use strictly checked TypeScript. Native Node tools use erasable `.mts` source; browser and package code is bundled from `.ts` or `.mts`. Compiled package imports retain their `.js` extension, while source-only Node imports name the actual `.mts` file. Preparation declarations come from their implementations.

The [ownership inventory](../../tools/typescript-ownership.json) has no authored JavaScript backlog. Its guard inspects tracked and untracked nonignored code, rejects new implementation JavaScript, and rejects production imports from excluded test or evidence locations. It also inspects Astro frontmatter, client scripts and literal script sources. A file's name cannot hide an implementation inside a test directory.

## Where JavaScript belongs

Existing tests, fixtures and browser/oracle harnesses remain executable JavaScript. Generated browser bundles and package distributions are ignored build products. The inventory names the other exceptions individually:

- Five generated data modules, each with its generator and source anchor.
- Three preserved Cesium modules with their upstream provenance.
- The Astro and ESLint configuration entry points.
- Five compatibility entry points that only re-export typed implementations.

Those compatibility paths are `src/platform/camera-math.mjs`, `sphere-drag.mjs`, `scene-lifetime.mjs`, `site/runtime-policy.mjs`, and `site/scene-contract.mjs`. The guard checks their exact exports and rejects implementation statements. Historical source records retain the original generator identity and pinned bytes; a historical `.mjs` name does not execute a deleted implementation.

## Strict checking

`pnpm typecheck` covers packages and their tooling, renderer, shared platform, preparation, root tools, shell, Astro, ownership enforcement and the typed browser-owner harness. External JSON starts as `unknown` and is checked where its geometry, observations, resources or optional capabilities are consumed. Offline adapters retain the actual types of their imported functions.

Node must satisfy `^22.18.0 || >=24.0.0`. Node strips types for native `.mts` execution; the TypeScript gates perform checking. Shell and native-tool configurations reject syntax requiring runtime transformation.

## Behavior and source comparisons

The migration preserves the generic object registry, shared shell and camera, retained DOM and prepared runtime data. Preparation owns geometry, textures, charts and source interpretation. Runtime transports and decodes those products.

The [celestial comparison](../../tools/evidence/celestial-typescript-parity.json) records exact equality for 52 freshly generated Mercury/Venus images from the original JavaScript and typed owners. The [presentation comparison](../../tools/evidence/presentation-typescript-parity.json) records complete raw presentation equality for identical pinned inputs. Each record identifies the compared owners and source hashes; these results do not claim reproduction of historical assets made from different recipes.

Full navigation preparation previously recompressed existing markers at Q75, while incremental publication retained decoded pixels. The owner now renders the pinned recipes, copies decoded tile rows and writes lossless atlases. Against the 406-body lossless baseline, both densities preserve exact alpha with at most one channel level of compositor rounding. The [navigation comparison](../../tools/evidence/navigation-lossless-atlases.json) records both this baseline and the later lossy publication, plus exact reproduction and publication rollback checks for the 432-body inventory. This is a preparation correction, separate from the JavaScript/TypeScript parity comparisons.

An Earth texture-level recipe already had its new hash in the descriptor but its parent hash in the source manifest. The manifest now pins the existing recipe bytes. The correction changes no scientific input or texture-level parameter; provenance is rebuilt through its owner.

## Contributor checks

```sh
pnpm check:typescript-ownership
pnpm test:typescript-ownership
pnpm typecheck
pnpm build
pnpm test:packages
pnpm test:renderer
node --test --test-concurrency=1 src/platform/*.test.mjs src/navigation/*.test.mjs tools/*.test.mjs
node --test --test-concurrency=1 site/test/*.test.mjs
pnpm test:preparation
```

Source/runtime closure, malformed-input and tampering tests, preparation comparisons and actual browser interaction provide different evidence. Record their current outcomes in the PR using the [template](../../.github/pull_request_template.md). A clean ownership inventory or typecheck alone does not prove application behavior or merge readiness.
