# Architecture rules

`index.mts check` runs resolved graph rules (`rules.mts`) and repository rules
(`repository-rules.mts`). Repository rules always fail on findings, including
baseline updates. Contract lint runs the check and `node --test .github/scripts/architecture/*.test.mts`.

- `bake-without-renderer.mts` locks bake's dependency fields and forbids bake entries
  in the preparation renderer exception list. `declared-dependencies.mts` rejects
  undeclared workspace imports; its E1 fixture proves a bake import fails without
  declaring renderer. The declaration scanner also checks literal `require.resolve` calls. `preparation-without-renderer.mts` retains telescope's exact
  publication/transport exceptions and rejects stale entries.
- `format-schema-ownership.mts` scans TypeScript, Python and Astro source for
  versioned schema literals, including type literals and embedded template scripts.
  `schemaOwner` groups packages, lab packages, site and top-level tooling directories.
  A raw id in two owners fails; any raw duplicate of an objects source definition
  also fails. One owner's internal ids need no inventory. Tests, fixtures, data,
  prepared outputs and compiled output are excluded. Python/Astro use exact quoted-id
  matching; TypeScript uses its syntax tree.
  `format-schema-exceptions.json` contains only `{ schema, owners, reason }` debt.
  Owner sets must match exactly; stale entries, duplicates and empty reasons fail.

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
