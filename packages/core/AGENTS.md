# Core package instructions

Own the runtime validation and the small helpers every other layer shares: predicates, throwing getters, labelled checks,
decoders and structural guards for values that arrive from outside the type system, plus vector, matrix and scalar math,
`median`, `isArray`, `canonical` and CLI argument parsing. Shared world rotation/reflection types and validation live in `src/math/world-rotation.ts`; objects parsers and engine navigation import this single definition.
Convex footprint edge admission and stellar limb-intensity arithmetic live in `src/math/`; format validation and sampling stay with callers.
Keep the main and `schema` entries dependency-free and host-neutral: no Node built-ins, DOM globals or file I/O, so the
browser runtime and the preparation tools import the same module. `src/node/` is the one exception: it is published as
`@cssearth/core/node`, may import `node:*` (the runtime asset content address, the project root), and nothing outside `src/node/` may import it.
The Node-only `src/node/oracle/` harness is exported as `@cssearth/core/oracle` (ESM only). Its Python
writer and pinned requirements are shipped beside the built fixture reader; domain cases stay with their owners.
Kernel verification is supplied by the caller, so core never imports preparation packages.
Owners explicitly register oracle input resolvers; their package metadata names an `oracleManifest` for generator and setup commands. Core validates registrations and contains no domain input layouts or body ids.
The Node entry collects quoted test globs from caller-supplied scripts; callers own manifest reading and lane names. Its builtins-only source is bootstrap-safe for CI.
Other file reading stays with the callers.
Tree-shaking must keep working: no top-level side effects beyond constant definitions.

## Messages are part of the contract

Tests, provenance tooling and archived reports quote these error messages. Change a message only on
purpose, together with every assertion that quotes it, and pin each wording in this package's tests.
A new dialect is added by parameters (a label, a `Fail` prefix, a shape context) rather than a copy.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside packages.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
