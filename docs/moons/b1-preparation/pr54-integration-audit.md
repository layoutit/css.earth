# PR54 integration preservation audit

At committed merge `133339e058fea24da729f187d8a6b17f99e61e54`, the **67P science and source payload matches latest main `9228eac5`**. Of 64 tracked package files, 62 are byte-identical; the remaining two differ only in the 28 intended navigation marker index/count fields and the descriptor's hash of `prepared/object.json`. All marker bindings exactly retain the B1 pre-merge values. The registry is unchanged at **253 objects**.

All **50 installed 67P runtime assets / 19,612,188 bytes** pass their pinned hashes and exact directory closure. The B1 publication remains unchanged: **28 package manifests and 874 assets / 199,806,888 bytes**. The committed merge preserves every B1 source manifest and its **478 source pin definitions** from `2900da4f`.

The subsequent Squannit correction changes exactly one of those source files: `source/preparation/terrestrial.json` adds `geometry.radialTerrain.backfaceVisible: true` (2,731 to 2,762 bytes), with the matching source-manifest pin refreshed. The other **477 source files** retain their previous bytes; all **478 current files** match the current expected SHA-256 values and byte counts. This deliberate opt-in is recorded separately from the PR54 merge and leaves the released mesh, orbit inputs and runtime image assets unchanged. This audit does not claim visual acceptance of the correction.

The refreshed aggregate source inventory has **827 missing pins / 13,580,332,983 bytes**, all traced to their matching baseline; B1 has zero omissions. [Source-gap report](integrated-source-gap-report.md). The original 822-pin receipt and original `2900da4f` gate receipts remain separately retained; no earlier test or visual claim is rebound to this merge.

This audit wrote only documentation. It performed no downloads, publication, source/runtime changes or additional test suite runs. The aggregate source verifier was rerun read-only and still fails first on the unchanged comet-1p omissions. [File-level hashes and semantic exceptions](pr54-integration-audit.json).
