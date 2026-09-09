# B1 runtime publication inventory

All 28 affected packages (26 new B1 scenes plus 2 existing parent packages) pass local byte-count, SHA-256, exact-directory, actual-consumer and prepared-descriptor closure checks. Fornjot was frozen after its final visible-copy rebake.

- Runtime inventory entries: **874**.
- Deduplicated publication keys: **874**, totaling **199,806,888 bytes (199.81 MB)**.
- Distinct content hashes: **95**, totaling 13,822,872 bytes (13.82 MB). This smaller diagnostic total cannot replace the required hash/filename URL set.
- Full pinned inventory: [runtime-publication-manifest.json](runtime-publication-manifest.json).
- Concrete upload input: `output/playwright/moons-b1-qualification/runtime-publication-bulk.json`. Publication completed through the root-owned publisher; this audit independently verified the published bytes.
- Fresh installer staged under `output/playwright/moons-b1-qualification`; its destination is a new empty `/tmp` directory recorded in the local staging plan; 874 published URLs downloaded through the existing `installRuntimeAssets` API, with 28 exact body closures verified.

|Body|Files|Bytes|Local closure|
|---|---:|---:|---|
|paaliaq|31|7020438|PASS|
|tarvos|31|7022594|PASS|
|ijiraq|31|7020834|PASS|
|suttungr|31|7018686|PASS|
|mundilfari|31|7019058|PASS|
|skathi|31|7019458|PASS|
|erriapus|31|7017144|PASS|
|thrymr|31|7020100|PASS|
|bebhionn|31|7021528|PASS|
|bergelmir|31|7018146|PASS|
|bestla|31|7015046|PASS|
|fornjot|31|7019866|PASS|
|hati|31|7019272|PASS|
|hyrrokkin|31|7020166|PASS|
|loge|31|7020486|PASS|
|skoll|31|7019764|PASS|
|greip|31|7018564|PASS|
|tarqeq|31|7021002|PASS|
|caliban|31|7023864|PASS|
|sycorax|31|7022584|PASS|
|prospero|31|7016584|PASS|
|setebos|31|7017278|PASS|
|hiiaka|31|7012306|PASS|
|squannit|31|7045802|PASS|
|romulus|31|7014588|PASS|
|menoetius|31|7021222|PASS|
|haumea|33|9520416|PASS|
|sylvia|35|7760092|PASS|

Remote fresh-install verification passed: 874 files downloaded, 199,806,888 bytes checked, and 874 files reused with network disabled. Full build, browser and PR qualification remains with the integration owner.

Integration revalidation at **2026-09-08T21:39:23.329Z** confirms that the **253-object registry** retains all 28 affected packages. All **28 runtime manifests are byte-identical** to the publication inventory, and all **874 current files / 199,806,888 bytes** match both their pinned SHA-256 values and the original downloaded files. Every published URL matches a successful original HTTP 200 receipt. No assets were changed, and no new download or publication was needed.

The original fresh-install observation remains **2026-09-08T21:08:50.920Z–2026-09-08T21:09:40.687Z** (874 installed, then 874 reused offline). Its unchanged receipt SHA-256 is `5dc2d3dc16c64607ef35f434cd1d2342ea37552991ab4539b590eb862f67e11a`. [Exact current file hashes and integration proof](runtime-integration-verification.json) record the current manifest hashes and each asset's source receipt URL. This checks runtime image compatibility; navigation bindings and aggregate build/browser checks remain with the integration owner.
