# Core package instructions

Own the runtime validation every other layer shares: predicates, throwing getters, labelled checks,
decoders and structural guards for values that arrive from outside the type system.
Keep it dependency-free and host-neutral: no Node built-ins, DOM globals or file I/O, so the browser
runtime and the preparation tools import the same module. Reading files stays with the callers.
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
