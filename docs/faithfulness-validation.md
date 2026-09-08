# Faithfulness repair validation

Validation used Node 24.19.0 and real Chrome 152.0.7977.76 on macOS. The initial checks below include
main `a133fe30cf419f4bd2200872a18a29e46328483d`; the later PR #41 merge is
recorded separately at the end. See
[the finding-by-finding corrections](faithfulness-fixes.md) for scientific scope
and unresolved interpretation limits. The newer moons retain their
upstream packages; this is not a new scientific audit of those bodies.

## Passing checks

- `pnpm acquire:planets -- --verify-only`: 87 bodies, 2,173 pinned files.
- `pnpm prepare:factsheets -- --check --editorial`: 87 bodies, 589 facts.
- Package and renderer suites, and all 785 platform tests from `pnpm test`.
- Final `pnpm test:shell`: 221/221, including byte-identical reproduction of
  the corrected shared navigation atlas. The initial full test run's sole
  remaining failure is therefore resolved in its complete owning suite.
- `pnpm build`; renderer and preparation typechecks.
- 139 universe/frame preparation tests, plus 53 focused epoch/source checks.
- 29 source-surface tests, nine independently computed full-source anchors,
  and four actual retained-leaf atlas witnesses (maximum RGB errors 1/1/2/1).
- Sun preparation 5/5: all 60 raster assets reproduce byte-identically with
  the unchanged mounted-file isolation guard. Moon/Pluto source closures 2/2.
- Selected-view Chrome checks at DPR 1 and 2, opposite pole views, and both
  shadow settings; touch layouts at 390 × 844 with no horizontal overflow.
  Reduced-motion changes preserve the permanent rotation explanation.
- `pnpm test:browser http://127.0.0.1:4285`: all 87 bodies at DPR 1 and 2
  (174 visits), plus six navigation hops at each density. Exactly one scene,
  stable retained DOM, no node/stylesheet growth, and zero reported errors.

The complete browser run used the production preview. After the final navigation
source/atlas correction, eight focused source/marker checks passed, the production
site was rebuilt, all three served navigation images matched their checked-in
bytes, and Itokawa passed again at both DPR 1 and 2. The earlier full browser run
is retained as evidence for the unchanged scene/interaction behavior.

## Fresh installation

Published the changed Jupiter, Mars, Itokawa, Ryugu, Eros and Bennu runtime
inventories through the existing immutable asset publisher. In a fresh export of
commit `39f52eee67f19c01a3637bf6c3998878b85aea86`, the documented setup CLI
downloaded all 1,304 files (157,470,061 bytes), with zero reused scene assets and
no source preparation. This is the combined install size, not measured cold page
transfer or decoded memory.

Each of those six routes and its corrected selected lens then loaded in a fresh
Chrome context against the production build, serving scene files only from that
new installation. Shared built HTML/bundles were supplied from the validated
build. Visible images decoded, exactly one textured scene mounted, and no page
errors or failed HTTP responses were observed. Cached development assets were
not used as installation evidence.

## Existing aggregate failures

These were checked against clean main `a133fe30`; they are not reported as green.

| Check | Existing discrepancy |
| --- | --- |
| `pnpm test:preparation` | Six remaining failures: Mercury/Venus encoded sky byte/hash fixtures; Ceres download coverage for a repository-authored map; Kleopatra's `.gitignore` directory allowlist; three Mercury parity fixtures with stale epoch wording or old marker layout. |
| `pnpm test:planets` | Stops in the Sun capability suite on three existing Moon/Pluto/Sun regeneration mismatches. The fixture omits canonical motion/facing finalization; Moon/Sun retain different pool capacities; Sun's stored orbit fade differs from the authored policy. Later bodies are not covered by this aggregate run. |
| Ceres surface test | Independently reproduced on main: seam-gutter pixel `[2,2,2,255]` versus expected `[1,1,1,255]`; other two Ceres surface checks pass. |

The original full preparation run passed 554/562. Its Earth-center expectation
was the one task-caused failure: the corrected test now parses and SHA-verifies
the pinned Horizons Earth-to-EMB vector independently. An obsolete marker fixture
was also repaired to remove both actual marker suppliers. Those two checks pass;
the six baseline failures above remain. This does not claim a second complete
preparation run passed.

The initial `pnpm test` run exposed a stale Itokawa navigation-image pin after its
scientific context image changed. The navigation recipe, manifest, descriptor
and shared atlases were subsequently corrected through their preparation owners.
The initial static Sun isolation run overlapped the build and detected a mounted
file change; its isolated rerun passed without weakening the guard. The initial
development browser server exited mid-run; production-preview evidence replaces
that incomplete run.

These records establish bounded source, numerical, installation and browser
checks. They do not establish live ephemeris accuracy, unresolved texture lineage,
or scientific accuracy for every pixel and newly registered body.

## Merge of PR #41

The conflict resolution incorporates main
`000b67d729dbc1f1f5ea75e183f8c06481da17f8`, including Aegaeon, Anthe and
Polydeuces, bringing the registry to 90 bodies. Shared marker atlases and the
Sun's navigation receipt were regenerated from the combined sources. The upstream
sync ownership list preserves both the new libration fitter and the fixed-epoch
ephemeris inputs.

All 523 existing generated geometry entries remain exactly unchanged; only the
three new bodies are added. This preserves the earlier faithfulness corrections.
Merge checks pass: 515 astronomy tests, 37 focused ephemeris/source/sync tests,
142 universe preparation tests, both registry-wide frame checks, astronomy
typechecking, source verification for 90 bodies / 2,233 files, and editorial
consistency for 90 bodies / 607 facts. The production site was rebuilt, and
Aegaeon, Anthe, Polydeuces, Sun and Itokawa pass real-Chrome retained-scene checks
at both DPR 1 and DPR 2 (ten visits). This targeted integration check does not
extend the earlier scientific audit to the three newly merged moons.
