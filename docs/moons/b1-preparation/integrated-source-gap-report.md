# Integrated source verification gap after PR54

At `133339e058fea24da729f187d8a6b17f99e61e54`, the **253-object registry** lacks **827 pinned source files / 13,580,332,983 bytes (12.65 GiB)** across **200 packages**. All missing expected byte counts and SHA-256 hashes exactly match the corresponding retained baseline. B1's 26 new moons have **zero missing sources**.

PR54 changes the 67P source package. Its current omissions are compared with latest main `9228eac50d9e38103f80add72d58dfef4c9210c3`; other historical omissions retain the `c6850e28` baseline and the 49 incoming asteroids retain `c61d1bf9`. The preceding **822 files / 13,536,279,715 bytes** receipt is preserved byte-for-byte in [the pre-PR54 inventory](integrated-source-gap-pre-pr54-inventory.json), [report](integrated-source-gap-pre-pr54-report.md), and [gate log](integrated-source-gate-pre-pr54.txt). The older 204-object inventory also remains unchanged.

|Scope|Missing files|Pinned bytes|Affected packages|
|---|---:|---:|---:|
|historical-204-missing-pin|657|11,186,178,084|150|
|incoming-pr54-comet-67p|17|834,639,543|1|
|incoming-49-asteroids|153|1,559,515,356|49|

The inventory change is **5 added paths**, **0 removed paths**, and **0 changed pins at retained paths**: net **5 files / 44,053,268 bytes**. 822 current missing rows retain the exact preceding expected bytes and hashes. Removal from the missing list may mean the new manifest no longer declares that source; it is not a claim of restoration. Per-path deltas are in [the current inventory](integrated-source-gap-inventory.json).

The read-only command `pnpm acquire:planets -- --verify-only` again exits **1**, first at `comet-1p` for `stars/eso0932a.tif` and `presentation/InterVariable.ttf`; it reports no undeclared files there. [Exact command log](integrated-source-gate.txt). That fail-fast result alone does not enumerate later packages.

All 33 historical PCK-named file receipts remain unchanged. No source downloads, copying, restoration, rebakes, runtime writes, or deletions were performed for this audit. Authored HTTP acquisition routes describe restoration mechanisms and have not been tested for current remote availability. Those existing and incoming-main sources were not restored as part of the B1 cohort.
