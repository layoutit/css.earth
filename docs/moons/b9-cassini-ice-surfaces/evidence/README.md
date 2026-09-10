# B9 collected evidence

Capture prefix: `b9-main`. Tested integration base: `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`.

The [browser index](browser-index.json) accounts for all 36 unique body/DPR/lens/lighting cases in 18 completed reports. Reports are copied without rewriting any bytes. Their original absolute machine paths and `CAPTURED_UNREVIEWED` status remain intact; the index maps retained artifacts to portable evidence paths. Human visual acceptance is separate.

Current checkout comparison: `CURRENT_CAPTURE_PINS_MATCH`. [Source checks](source-checks.json) record the exact captured-file comparison and verify the packaged Cassini inputs, numerical outputs and support/ownership TIFFs against source manifests. Source replay: `PASS_21_EXACT_TIFFS_CURRENT_PINS`.

[Package closure](packages.json) retains its original status and scope, including any shared audit limitation. Its retained scene hashes must match the captures; browser snapshots and drag checks require stable ownership and leaf counts across all selected views.

All screenshot bytes are checked against the original reports, including images not duplicated here. The compact checked-in selection includes every DPR1 scene, unlit DPR1 scientific detail/legend screenshots, and one unlit DPR2 ice scene per body. Identical screenshots and styles are deduplicated. Every captured stylesheet is retained. Bounded resource receipts and capture logs are under `checks/`.

This evidence does not establish compositor frame rate, native renderer parity, exact absolute scientific registration, or general platform readiness. Failed combined browser runs are excluded; successful split runs provide the corresponding cases.
