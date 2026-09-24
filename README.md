# Focus connection refactor: evidence

Tested revisions: `main` at `1ee918fd45` and the change at `f2c1837c95` (refactor/context-navigation-binding).

## Oracle (`scenarios.mts`, `oracle-context-harness.mts`, `oracle-report.json`)

```sh
cp oracle-context-harness.mts site/test/.oracle-context-harness.mts; cp scenarios.mts output/context-oracle/
jankmonster oracle --file site/prepared-context-navigation.mts --before 1ee918fd45 --after f2c1837c95 \
  --scenarios output/context-oracle/scenarios.mts --mutants 12
```

This uses Jankmonster's `oracle` command (alowpoly/jankmonster `7fa2fd1`). The harness is `site/test/prepared-context-navigation.test.mts` with its `test()` calls collected instead of run and its factory injected, so each of the 24 tests runs as a scenario against both versions of the file, each in its own process. After every test, everything its fixtures captured is recorded: published content, flights, selections, URL writes, lens writes, errors, and the focus handed to presentation and flight.

The result: 24 of 24 identical, all 26 changed code lines run on the change and all 27 on main, and 12 of 12 automatic mutants of the changed lines caught. The test file is read from the working tree on both sides, so the new test "a disconnected or destroyed focus ignores its old camera owner" runs against main too, and passes there.

## In the app (`capture.mjs`, `app-*.json`, `app-pixelmatch.txt`)

Headless Chromium against one local dev server, with main's file swapped in for the main runs. Main ran four times and the change five. The flows:

- `/earth/?focus=m42` opened directly.
- `/earth/`, then search "andromeda" and pick the first result (Andromeda XVI), then search "m42" and pick it (`m42-after-switch.png`), then clear the focus with the "Local Group" breadcrumb.

The recorded URL, focus id, focus card visibility, name and selection are the same in all nine runs. Every frame is 0 changed pixels against main-1, at threshold 0.1 and at 0, except the cleared frame in main-3 and change-2. Both show one extra "LMC" label in the Local Group overview (`lmc-label-race.png`, left normal, right the extra label). It appears on both versions, so it is a label timing race in the overview, not this change.
