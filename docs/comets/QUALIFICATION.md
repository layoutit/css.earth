# Qualification record

The three-comet implementation is integrated with base **1398bd9025940b6fb0d0188dfa518cdfacba782e**. Full-suite evidence was captured at **6724acda**. The subsequent **5042c066** correction changes 67P's caption and associated provenance from 4 to **3 September 2026**, matching the existing numerical epoch JD 2461286.5; it changes no mesh, raster asset, orbital calculation or interaction behavior. Source verification, a full build, affected comet checks and all six production drag captures were refreshed after that correction. Later documentation commits package those results.

| Check | Result |
| --- | --- |
| `pnpm acquire:planets -- --verify-only` | PASS, all 74 registered objects; repeated after the caption correction |
| `pnpm test` | PASS at the integrated implementation: packages, renderer, 735 platform tests and 220 shell tests |
| `pnpm build` | PASS, including runtime assembly; repeated after the caption correction |
| `pnpm test:browser http://127.0.0.1:4258` | PASS: 148 object/DPR cases and two six-hop navigation cases; zero problems. Affected 67P DPR 1/2 checks repeated after the caption correction |
| Detailed comet conformance | PASS, development build with diagnostics: 9 cases for 67P, 13 each for Hartley 2 and Tempel 1, including DPR 1/2, mobile, pre-ready behavior and applicable lens races/failures. 67P repeated after the caption correction |
| Registry-derived comet navigation | PASS, production build, DPR 1/2: Earth and every comet, including repeat visits; one scene throughout; shell/universe identity and node/style counts retained |
| Source geometry and constraint tests | PASS: original source positions, winding, closed topology, volume retention, categorical source flags and reproducible map bytes. Six comet geometry/distance/trace tests passed again after the caption correction |
| Source-fit measurements | Source/prepared nearest-surface distances and six-view ray comparisons recorded with limitations in [GEOMETRY.md](GEOMETRY.md) |
| Fresh source restoration | PASS: ten real downloads across three empty source directories; exact source hashes verified; checked-in authored inputs copied explicitly. Repeated with corrected caption inputs |
| Fresh runtime restoration | PASS: 99 downloads, zero reused files, 22,102,428 bytes verified against published inventories; all 99 current assets still match this receipt |
| Production drag traces | PASS for retained DOM, asset identity, error and request checks at 5042c066; measured timing limits in [PERFORMANCE.md](PERFORMANCE.md) |
| `pnpm test:preparation` | 494/501 pass; all seven failures reproduce on the unchanged isolated base (477/485 pass there, including one additional Sun manifest-pin failure corrected here) |

The seven preparation failures concern Mercury/Venus celestial compatibility, Ceres refresh coverage expecting `presentation/surface-map.json`, Kleopatra's extra `.gitignore` file, Mercury physical-scene compatibility bytes, Mercury marker/phase/catalogue bytes, Mercury Sun-presentation compatibility bytes, and the missing-marker rejection expectation. The isolated baseline at `/tmp/cssEarth-comets-baseline-1398` uses the exact base source, restored matching inputs/assets, built packages and regenerated object payloads, and has no tracked diff. No tolerance or assertion was weakened to hide these failures. Log hashes are in [gate-log-hashes.json](evidence/gate-log-hashes.json).

Integration also corrected two inherited contract issues: the Sun content manifest now pins its existing checked-in bytes, and major-body label styling selects registry classifications instead of a literal Sun id. The latter preserves the current styling and passes the 54 focused ownership/layout checks. Neither change adds a comet-specific shell path.

The detailed harness requires development-only diagnostic APIs. Earlier production attempts with that harness timed out and are **invalid evidence**. An earlier development capture interrupted by hot reload and tests run during incomplete post-rebase asset restoration are also excluded. Accepted production checks use DOM and network observations without diagnostic APIs. Accepted conformance, production DOM/navigation and fresh-restore reports are under [evidence](evidence). The full 148-case report is `production-dom.json`; the caption follow-up is `67p-caption-dom.json`.

![67P production preview](evidence/67p.png)
![Hartley 2 source constraints](evidence/103p.png)
![Tempel 1 source constraints](evidence/9p.png)

Visual acceptance remains **provisional**. Repeated Chrome captures intermittently omit Hartley 2 header badges; one headless capture omitted the body and shell, and a headed capture omitted several SVG shell titles. DOM bounds, visibility and hit targets remain correct, and another unchanged-page capture is complete. The cause is unresolved; this is not established as a baseline issue or merely a screenshot bug. The [capture record](evidence/capture-anomalies.json), [complete repeat capture](evidence/103p-repeat-capture.png) and [headed capture](evidence/103p-headed-capture.png) preserve the distinction. The DOM and timing passes above do not prove every frame painted correctly.

These are unmodified browser screenshots. The original NAVCAM reference beside 67P has a different observer, epoch, pose and optical model; no photograph/browser pixel-parity claim is made. Hartley 2 and Tempel 1 colors identify source constraints, not observed albedo. All three retain the interpretation limits described in their source notes.

Existing-object payload changes rebind shared heliocentric marker indices/counts after adding entries to the common atlas. Existing object-owned geometry and materials are unchanged. The application still mounts one object scene through its generic adapter and shared shell. Wild 2, Borrelly and Halley remain explicitly unresolved candidates in [CANDIDATES.md](CANDIDATES.md), with no placeholder routes.
