# Architecture rules

`index.mts check` runs resolved graph rules (`rules.mts`) and repository rules
(`repository-rules.mts`). Repository rules always fail on findings, including
baseline updates. Contract lint runs the check and `node --test .github/scripts/architecture/*.test.mts`.

- `bake-without-renderer.mts` locks bake's dependency fields and forbids bake entries
  in the preparation renderer exception list. `declared-dependencies.mts` rejects
  undeclared workspace imports; its E1 fixture proves a bake import fails without
  declaring renderer. The declaration scanner also checks literal `require.resolve` calls. `preparation-without-renderer.mts` retains telescope's exact
  publication/transport exceptions and the declared renderer build-config metadata reader, and rejects stale entries.
- `format-schema-ownership.mts` scans TypeScript, Python and Astro source for
  versioned schema literals, including type literals and embedded template scripts.
  `schemaOwner` groups packages, lab packages, site and top-level tooling directories.
  A raw id in two owners fails; any raw duplicate of an objects source definition
  also fails. One owner's internal ids need no inventory. Tests, fixtures, data,
  prepared outputs and compiled output are excluded. Python/Astro use exact quoted-id
  matching; TypeScript uses its syntax tree.
  `format-schema-exceptions.json` contains only `{ schema, owners, reason }` debt.
  Owner sets must match exactly; stale entries, duplicates and empty reasons fail.
- `site-build-format-readers.mts` requires build readers to admit shared JSON through
  objects parsers before projection. Its AST scan discovers source addresses from
  tracked schema-bearing records; objects reader ledgers name generated addresses
  and format-specific readers. It follows local aliases, transports, callbacks and
  literal filename loops. Computed and cross-module paths remain analysis limits.

The declared import scanner and resolved graph do not prove arbitrary computed
runtime paths. There is no custom import-form parser. Binary magic/version values
without schema ids are outside the literal rule: generic numeric/string matching
cannot distinguish format constants from unrelated values reliably.

See [prepared format ownership](../../../docs/prepared-format-ownership.md) for the contract and limits.

The source-manifest exception is retained only for the pre-build body-reference check
and preserved Python distant-worlds authoring.
[Schema-identifier conformance tests](../../../packages/bake/src/sources/python-schema-identifiers.test.ts)
pin the manifest, archived-camera and object-text Python literals to their browser-safe objects constants.
The archived-camera and object-text exceptions retain only bake as an owner: preserved Python writers cannot
import TypeScript. Changing any retained spelling must fail its conformance test.

Other preserved Python grid, registration and native star-processing protocols retain specific ledger reasons.
[Grid conformance](../../../packages/bake/src/shell/shell-grid-schema.test.ts) and
[lab protocol conformance](../../../labs/nebula/packages/lab/src/server/services/schema-protocols.test.ts)
pin their source checks and retained fixtures. Bake recipe routing identifiers stay bake-owned;
the molecular catalogue wrapper stays lab-owned, separate from reconstruction table data.

Workspace build order is derived from `pnpm-workspace.yaml` and package manifests by
`packages/bake/src/preparation/workspace-graph.ts`, a Node-only bootstrap reader.
`node .github/scripts/architecture/workspace-builds.mts` prints dependency-first build names;
`--run` builds them. Optional package names select their dependency closure.

## Boundary and retained limitations

This subsystem owns repository policy, CI findings and the repository-specific
baseline. Its resolver, zones and exceptions describe this checkout; it is not a
published architecture library. Keeping those authored inputs beside the check
is intentional (A1); extraction would add an API without an external consumer.

Integration independence currently uses declared workspace dependencies only.
Non-workspace site, source and script owners have no manifest dependency edges;
this is not proof of source-graph independence (A102). Extending it requires a
resolved owner graph, including build/runtime distinctions, rather than guessing
edges from owner names.

Preparation additionally recognizes literal sibling renderer URLs, package
imports targets, tsconfig extends and compiler-option paths. It still does not
prove computed loaders, configuration inheritance or a dependency routed through
an exempt consumer's re-export (A202/A251). The telescope implementation bundler reads the renderer build configuration through the declared
`RENDERER_BUILD_CONFIG_PATH`, which the rule checks as a named metadata exception (A203).

Every PR contract-lint lane also runs `checks/check-stale-references.mts` and its tests.
The short `checks/retired-paths.mts` ledger identifies drained paths from rename history
and the relocated owners whose checkout roots must stay module-relative. The check
reads live commands, manifests, documentation, CI paths, generator literals and import
specifiers. Historical records retain the old path with an adjacent `(now ...)`
replacement; test fixture text is excluded through syntax, while actual test imports
and process calls are checked. Extend the ledger when another owner is retired.
