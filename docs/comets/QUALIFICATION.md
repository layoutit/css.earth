# Qualification record

This record binds the three-comet implementation and production captures at **a965d046**, based on **0bea5c212093c184f184276e33ce01aaa82a9703**. Later changes in main are not covered by these captures. Updated integration must be qualified again before this record is described as current-main evidence.

| Check | Result |
| --- | --- |
| `pnpm acquire:planets -- --verify-only` | PASS, all 61 registered objects |
| `pnpm test` | PASS: packages, renderer, 695 platform tests and 220 shell tests |
| `pnpm build` | PASS, including runtime assembly |
| `pnpm test:browser http://127.0.0.1:4258` | PASS, production build: 122 object/DPR cases and two six-hop navigation cases; zero problems |
| Detailed comet conformance | PASS, development build with diagnostics: 9 cases for 67P, 13 each for Hartley 2 and Tempel 1, including DPR 1/2, mobile, pre-ready behavior and applicable lens races/failures |
| Registry-derived comet navigation | PASS, production build, DPR 1/2: Earth and every comet, including repeat visits; one scene throughout; shell/universe identity and node/style counts retained |
| Source geometry and constraint tests | PASS: original source positions, winding, closed topology, volume retention, categorical source flags and reproducible map bytes |
| Fresh source restoration | PASS: ten real downloads across three empty source directories; exact source hashes verified; checked-in authored inputs copied explicitly |
| Fresh runtime restoration | PASS: 99 downloads, zero reused files, 22,102,428 bytes verified against published inventories |
| Production drag traces | PASS for retained DOM, asset identity, error and request checks; measured timing limits in [PERFORMANCE.md](PERFORMANCE.md) |
| `pnpm test:preparation` | 436/440 pass; four failures also reproduce on the unchanged base commit (420/424 pass there) |

The four preparation failures are the Mercury/Venus celestial compatibility snapshot, Ceres refresh coverage expecting `presentation/surface-map.json`, Mercury marker/phase/catalogue compatibility bytes, and the missing-marker rejection expectation. The isolated baseline at `/tmp/cssEarth-comets-baseline-0bea` uses the exact base source, matching restored inputs/assets, built packages, and has no tracked diff. No tolerance or assertion was weakened to hide these failures. Logs are retained locally; their hashes are in [gate-log-hashes.json](evidence/gate-log-hashes.json).

The detailed harness requires development-only diagnostic APIs. Attempts to run it against production therefore timed out and are **invalid evidence**. A prior development capture interrupted by hot reload is also invalid. The accepted production checks use DOM and network observations without those diagnostic APIs. Accepted conformance reports, production DOM/navigation reports and fresh-restore records are under [evidence](evidence).

![67P production preview](evidence/67p.png)
![Hartley 2 source constraints](evidence/103p.png)
![Tempel 1 source constraints](evidence/9p.png)

These are unmodified browser screenshots. The original NAVCAM reference beside 67P has a different observer, epoch, pose and optical model; no photograph/browser pixel-parity claim is made. Hartley 2 and Tempel 1 colors identify source constraints, not observed albedo. All three retain the interpretation limits described in their source notes.

The many existing-object JSON changes are regenerated shared marker indices/counts after adding entries to the common atlas. They do not add additional rendered nuclei or object-owned shells. Shared runtime rendering remains preparation-owned, retained DOM through the generic object adapter.
