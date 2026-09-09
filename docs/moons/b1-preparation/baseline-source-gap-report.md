# Historical source verification gap: 204 objects

The pre-integration 204-object checkout at `c6850e28`, with the B1 work present, lacked **669 pinned source files** totaling **11,976,764,359 bytes (11.15 GiB)** across **151 packages**. No sources were restored: this exceeds the authorized <1 GiB restoration scope.

- Unique missing content: 397 hashes, 6,808,995,900 bytes; repeated shared inputs increase local materialization.
- 637/669 missing entries belong to source manifests unchanged from base c6850e283952.
- New B1 moons missing inputs: 0.
- All 33 discovered existing PCK-named files were read and left unchanged; their hashes are retained in the inventory.
- Incoming origin/main asteroid additions are outside this 204-package inventory.

|Restoration classification|Files|Pinned bytes|
|---|---:|---:|
|authored-direct-download|642|11387187660|
|no-matching-authored-target-operation|18|58701446|
|authored-generated-extracted-or-request-dependent|9|530875253|

Direct-download labels mean an authored HTTP download operation exists, without response transformation; they do not prove current endpoint availability. Other classes include generated inputs, archive extraction, request-based responses, and recipes without a matching target operation. No bulk source acquisition, copying, rebaking, or deletion occurred. Full file-level details and baseline hashes are in baseline-source-gap-inventory.json.

Entry-level baseline check: 669/669 missing files have the same expected byte count and SHA-256 in the base revision, including entries in changed source manifests.

Full required command independently reproduced: `pnpm acquire:planets -- --verify-only` exited 1 at `comet-1p`, reporting missing `stars/eso0932a.tif` and `presentation/InterVariable.ttf`, with no undeclared sources. Both pins are unchanged from the base revision. The retained command output is [baseline-source-gate.txt](baseline-source-gate.txt), with checkout-specific path prefixes normalized. This gate remains blocked by preexisting source omissions.

This is retained historical evidence. The later merge of `c61d1bf9` adds 49 asteroid objects, bringing the registry to 253. The current scope and both baseline comparisons are reported in [integrated-source-gap-report.md](integrated-source-gap-report.md). Numeric source inventory entries remain unchanged from the original audit.
