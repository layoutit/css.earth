# Integrated source verification gap: 253 objects

The integrated checkout lacks **822 pinned source files** totaling **13,536,279,715 bytes (12.61 GiB)** across **200 packages**. No sources were restored.

This inventory covers the 204 objects on the B1 branch and the 49 asteroid objects added by main at `c61d1bf9`. Existing omissions are checked against `c6850e28`; incoming asteroid omissions are checked against `c61d1bf9`. The original 204-object audit remains in [baseline-source-gap-report.md](baseline-source-gap-report.md).

|Scope|Missing files|Pinned bytes|Affected packages|Pin comparison|
|---|---:|---:|---:|---|
|historical-204-missing-pin|669|11,976,764,359|151|All bytes and hashes match baseline|
|incoming-49-asteroids|153|1,559,515,356|49|All bytes and hashes match baseline|

- Missing pinned inputs for the 26 B1 moons: **0**.
- Unique missing content: 411 hashes / 6,859,076,009 bytes.
- All missing byte counts and hashes match their respective baseline: **822/822**.
- Historical PCK-named files rechecked unchanged: **33/33**.

|Restoration route|Files|Pinned bytes|
|---|---:|---:|
|authored-direct-download|795|12,946,703,016|
|no-matching-authored-target-operation|18|58,701,446|
|authored-generated-extracted-or-request-dependent|9|530,875,253|

An authored HTTP route does not prove current endpoint availability. Several other inputs require generated data, extraction, or request-specific acquisition. The total exceeds the bounded restoration scope; no source downloads, source copying, rebakes, overwrites, or deletion were performed. File-level source paths, expected bytes/hashes, acquisition routes, and the matching baseline pins are retained in [integrated-source-gap-inventory.json](integrated-source-gap-inventory.json).

The required full command `pnpm acquire:planets -- --verify-only` was rerun on this 253-object registry and exited **1** at `comet-1p`: missing `stars/eso0932a.tif` and `presentation/InterVariable.ttf`, with no undeclared inputs. Both pins match `c6850e28`. The command stops at the first failed package; the inventory above independently covers every registered package. [Retained command output](integrated-source-gate.txt) normalizes checkout-specific path prefixes.
