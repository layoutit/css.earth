**P1 — child success is asserted against TAP summary lines, but the child is spawned with Node’s default reporter.**

`element-budget.test.ts` 23–29 and `objects.test.ts` 23–29 run `spawnSync(process.execPath, ['--test', outfile], …)` with no `--test-reporter` (and no TAP-forcing env). Node 22’s default is `spec`. Piped stdout is not a TTY; spec still prints `ℹ tests N` / `ℹ pass N` / `ℹ fail 0`, not `# tests N`.

The wrappers then `assert.match(output, /# tests 9\b/)` (and `6`) plus `# pass` / `# fail 0`. A fully passing child therefore fails the wrapper; a failing child is still caught by `result.status === 0`, but the required positive counts never lock.

That is not a launch-only wrapper in the success path: it can go red without a case failure, and it never proves 9/6 under the reporter CI actually gets.

**Fix at this layer:** pass `'--test-reporter', 'tap'` (or `'--test-reporter=tap'`) on the child argv so the existing `# tests` / `# pass` / `# fail` assertions match what the child prints. Do not rely on inherited env.

No P0. No other borderline P2 on execute/assert/failure-surfacing: `NODE_TEST_CONTEXT` is stripped so this is a real nested runner; esbuild throw, spawn `error`, non-zero status, and wrong counts all fail the parent test; cases are the bundled entry, not a stub.

=== REPORT COMPLETE ===
