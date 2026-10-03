# Integration test instructions

Put a test here only when it needs two or more independent owners at the same time, through their public entries. Independent means neither owner depends on the other. The architecture check refuses integration files that span fewer than two independent owners.

Everything else lives beside the code it tests:

- **One package:** the test goes in that package, next to the module.
- **Using shared libraries** (`core`, `engine`, `objects`): that alone does not make it an integration test. It belongs to the package under test.
- **A writer and a reader of one prepared format:** test each side against the `objects` contract in its own package.
  - The writer's test checks that its output passes the `objects` parser.
  - The reader's test reads a fixture built with `objects`.
- **Site or application code:** the test goes in `site/` or the application's own test folder.

Before you add a file here, list the `@cssearth/*` owners it imports. If only one owner remains once the shared libraries are left out, move the test to that owner.

Rules for tests that do belong here:

- Import package entries only. No private `.ts` paths inside another package, and no relative paths into `site/` or `src/`.
- Name the folder for the behaviour it proves (for example `eclipse-map`), not for its owners or after a copy of a package's folder layout.
- Fixtures and helpers stay inside the suite's folder.

`prepared-object-mount/` proves that bake prepares an object, objects parses it, and renderer mounts it. Writer and reader unit coverage stays in its owning package.
