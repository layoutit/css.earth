# TypeScript ownership

Application, preparation, source-authoring, tests, executable fixture helpers and capture/oracle implementations are required to use strictly checked TypeScript. Native Node tools use erasable `.mts` source; browser and package code is bundled from `.ts` or `.mts`. Compiled package imports retain their `.js` extension, while source-only Node imports name the actual `.mts` file. Preparation declarations come from their implementations.

The [ownership inventory](../../tools/ci/typescript-ownership.json) has no remaining authored JavaScript backlog entries. Its guard inspects tracked and untracked nonignored code, rejects new implementation JavaScript, and rejects production imports from excluded test or evidence locations. It also inspects Astro frontmatter, client scripts and literal script sources. A file's name cannot hide an implementation inside a test directory.
Evidence tooling lives under `tools/audits/` and `tools/oracles/` or in files named
`capture`, `captures` or `evidence`; it may import test harnesses, while runtime
owners may import neither test nor evidence modules.

## Where JavaScript belongs

Test directories and capture filenames do not exempt authored code. Data fixtures retain their native formats; executable fixture helpers and browser/oracle harnesses are TypeScript. Generated browser bundles and package distributions are ignored build products. The inventory names the remaining JavaScript exceptions individually:

- Three preserved Cesium modules with their upstream provenance.

The shell title, icon, overview-title and wordmark data modules are ignored build
products, like the navigation-marker module. `pnpm prepare:shell` restores the
hash-pinned Inter font when missing, prepares the object catalogue, then replays
the four generators. The source vectors, font recipe and generators remain
committed. Installation, development, builds, asset setup and the root test command
run this preparation before consuming the modules.

Astro and ESLint use `.mts` configuration entry points, checked by
`pnpm typecheck:configs` and the main typecheck command. The pinned `jiti`
development dependency lets ESLint load its TypeScript configuration normally.

Application and test consumers import typed owners directly. The five obsolete
JavaScript compatibility entry points have been removed. Historical source
records retain the original generator identity and pinned bytes; a historical
`.mjs` name does not execute a deleted implementation.

## Retained and retired oracle tools

The final authored-JavaScript inventory contained 46 oracle modules. Forty-three
were retained as strict TypeScript: seven Venus image/capture owners and 36 Mars
native-capture, calibration and comparison owners. Shared decoders validate the
external records those tools consume without discarding unrelated evidence.

Three superseded Mars tools were retired: `capture-pixelmatch` used the removed
material-cache API, while `prepare-google-calibration-overlay` and
`map-google-calibration-overlay-draws` used the old KML/color-similarity mapping.
The retained rendered-frame/triptych and exact cache-address calibration workflows
provide their replacements. Historical source records and original evidence stay
unchanged.

## Strict checking

`pnpm typecheck:oracles` checks the retained native Mars and Venus owners, their
transitive imports and direct regression tests in strict mode. Their migration
also repairs relocated app/cache paths, obsolete capture selectors and input
receipt decoding. Native captures require the documented local Google Earth Pro
setup; compilation and offline comparison do not establish live native parity.

The repository-wide gate still covers earlier TypeScript migrations and all other
surfaces. An `.mts` extension alone does not establish strict ownership. Missing
local prepared assets or failures in that broader gate must be reported separately,
not hidden by the focused oracle check.

`pnpm typecheck` covers packages and their tooling, renderer, shared platform, preparation, root tools, shell, Astro, ownership enforcement and tests, including executable fixtures and browser/capture/oracle scripts. `pnpm typecheck:tests` checks every file discovered by the strict [test configuration](../../tests/tsconfig.json) in sequential compiler groups to bound memory use; native Node execution alone does not typecheck it. External JSON starts as `unknown` and is checked where its geometry, observations, resources or optional capabilities are consumed. Offline adapters retain the actual types of their imported functions.

Node must satisfy `^22.18.0 || >=24.0.0`. Node strips types for native `.mts` execution; the TypeScript gates perform checking. Shell and native-tool configurations reject syntax requiring runtime transformation.

## Behavior and source comparisons

The migration preserves the generic object registry, shared shell and camera, retained DOM and prepared runtime data. Preparation owns geometry, textures, charts and source interpretation. Runtime transports and decodes those products.

The [presentation comparison](../../tools/evidence/presentation-typescript-parity.json) records complete raw presentation equality for identical pinned inputs. The record identifies the compared owners and source hashes; this result does not claim reproduction of historical assets made from different recipes.

Full navigation preparation previously recompressed existing markers at Q75, while incremental publication retained decoded pixels. The owner now renders the pinned recipes, copies decoded tile rows and writes lossless atlases. Against the 406-body lossless baseline, both densities preserve exact alpha with at most one channel level of compositor rounding. The [navigation comparison](../../tools/evidence/navigation-lossless-atlases.json) records both this baseline and the later lossy publication, for the 461-body inventory. Its subsequent-merge record extends the atlas to 464 bodies by preserving all existing tiles and adding the three incoming tiles, with zero changed visible pixels. Navigation preparation tests cover full reproduction and publication rollback. This is a preparation correction, separate from the JavaScript/TypeScript parity comparisons.

The [source-authoring comparison](../../tools/evidence/source-authoring-typescript-parity.json) covers the twenty comet meshes, the catalogue and astronomy records, 48 open-orbit cases, and nine distant-world source finalizations. Offline CLI replay supplies the original Horizons responses and native mesh bytes to both implementations; it does not claim a fresh native C++ build.

An Earth texture-level recipe already had its new hash in the descriptor but its parent hash in the source manifest. The manifest now pins the existing recipe bytes. The correction changes no scientific input or texture-level parameter; provenance is rebuilt through its owner.

## Contributor checks

```sh
pnpm install
pnpm check:typescript-ownership
pnpm test:typescript-ownership
pnpm typecheck:oracles
pnpm typecheck
pnpm build
pnpm test:packages
pnpm test:renderer
node --test --test-concurrency=1 src/platform/*.test.mts src/navigation/*.test.mts tools/*.test.mts
node --test --test-concurrency=1 site/test/*.test.mts
pnpm test:preparation
```

Source/runtime closure, malformed-input and tampering tests, preparation comparisons and actual browser interaction provide different evidence. Record their current outcomes in the PR using the [template](../../.github/pull_request_template.md). A clean ownership inventory or typecheck alone does not prove application behavior or merge readiness.
