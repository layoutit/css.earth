# B8 qualification

**Selected three-moon implementation and visual review complete; draft with
unresolved aggregate release gates.** Integration base:
`1fb76e44d6bf831e7ebcf0516b83c0b10e1716da`. Final captured implementation:
`b0df1a8ef46ad93a5c4893140a58772a79a80a11`.

## Passed scope

| Check | Result |
| --- | --- |
| Numerical converters | 15 focused tests pass. |
| Fresh source restoration | All 21 original numerical files fetched into an empty destination; all 11 scientific map TIFFs reproduce byte for byte. |
| Independent MUSE review | Original arrays, every selected TIFF/grid, manifest and converter pins, night order, masks, orientation evidence and diagnostic panels checked. |
| Independent Enceladus review | 94,916 supported values per field match independent native-cube calculations; 192 spherical source-cell probes per field pass. |
| Moon unit tests | All 11 existing Io/Ganymede/Enceladus source, photographic registration, runtime and orbit tests pass with the new controls. |
| Scientific preparation | All 23 raster, quality, focus, texture-scale, radial projection and profile tests pass. Missing unrelated profile fixtures were restored from exact HEAD before the successful rerun. |
| Package tests | All 762 tests pass, with package and test-file concurrency serialized. |
| Build components | Package, renderer and preparation builds pass. The final integrated rebuild leaves generated renderer/preparer bytes unchanged. |
| Prepared replay | All three canonical body descriptors and prepared-file inventories reproduce byte for byte using the rebuilt preparers. |
| Body/source/runtime closure | All three packages pass. Shared runtime ownership audit completes without violations; scene bytes and retained runtime trees match the integration base. |
| Delivery | 20 new images / 585,804 bytes. All 134 selected-body image files freshly installed, with zero cache reuse and verified hashes. Existing image bytes are unchanged. |
| Desktop capture | Six Chrome runs, DPR1/2, 32 normal/new-view lighting cases; exact fetched object/image identity, painted leaves, real dataset buttons, legends, entry flights, source/factsheet tabs and drag/zoom retention pass. |
| Visual review | All five new views accepted after visible scientific caveats and readable legend units were added. See the specialist acceptance record and source/browser comparisons. |
| Shared DOM cleanliness | All three moons pass at DPR1/2, including real drag with retained node identity and no topology changes. |
| Selected shared conformance | All three moons pass mobile policy, dataset interactions at DPR1/2, lens races, reacquisition, rejection/retry and destroy checks: 21 selected cases. Other conformance cases are explicitly skipped, not counted as passed. |

Browser contexts, browsers and task-owned servers close after each invocation.
Heavy builds, preparation, tests and captures run one at a time. Resource
receipts retain measured process-tree RSS and free-memory samples; no enlarged
Node heap is used. The image increment above excludes existing/shared images,
object JSON transport and this review documentation.

## Aggregate gates remain open

After the final captures, main advanced to
`f7b7e856e144f93decee45580f07120428036c05` with shared overview/orbit-navigation
changes. A read-only merge-tree check succeeds without conflicts, but the
combined state with that newer shared code has not been browser-qualified.
This draft retains the tested implementation above; integration with the newer
main is an additional gate before readiness. These captures do not establish
behavior on that newer renderer/shell state.

The broad checks ran against the isolated selected-body checkout. Their
failures are retained in the evidence rather than treated as passing or
silently waived. No failing block identified a B8 spectral input or one of the
three upgraded moon packages, but this is not an exhaustive baseline proof.

| Gate | Recorded outcome and limit |
| --- | --- |
| Renderer aggregate | 305 tests pass, 17 fail; 16 files fail including fixture-load failures. Reported causes are missing non-B8 prepared/source inputs. |
| Platform aggregate | 422 pass, 1,265 fail. Mostly missing registry/source/catalogue fixtures; also missing `cwebp` vendor binary, six other moons' transport SHA mismatches in two test families, and astronomy upstream-manifest assertions. The assertion causes were not fully classified. |
| Shell aggregate | 240 pass, 34 fail. Missing non-B8 inputs, unavailable `urijs`, and a zero-chart-count assertion whose cause is unproven. |
| All-object source verification | Stops at missing Polymele `source/manifest.json` in this checkout. The selected three source closures and fresh numerical restorations pass separately. |
| Production build | Astro compilation completes, but static route rendering stops at missing Abundantia `prepared/object.json`. Full production build/assembly is unqualified. |
| All-object browser cleanliness | Stops at Polymele's missing prepared object transport; the three selected body runs pass separately. Full-registry conformance and deployment are unqualified. |

`pnpm test` was exercised as its four constituent suites with bounded
concurrency, preserving the failing results above. The production attempt ran
`pnpm exec astro build` after component builds; it does not establish that the
complete `pnpm build` lifecycle or assembly passes. The browser and acquisition
attempts use the repository's normal runners. See raw commands and logs in the
machine-readable qualification index.

The existing hidden Settings button also prevents a public Settings-access
claim. Capture tests exercise its existing hidden input binding to inspect both
lighting states. Scientific boundaries remain: approximate registration,
partial/coarse observations, retained seams and archive filtering, no corrected
global Enceladus mosaic, and no abundance, temperature or crystallinity result.
No compositor performance or native-renderer pixel-parity claim is made.

## Evidence

- [Machine-readable qualification and resource/log index](evidence/qualification.json)
- [Visual review](VISUAL-REVIEW.md) and [specialist acceptance](evidence/visual-acceptance.json)
- [Browser captures, byte pins and artifact index](evidence/browser-index.json)
- [Source review](evidence/source-review.json), [fresh restoration](evidence/source-reproduction.json), and [package closure](evidence/packages.json)
- [Fresh image delivery](evidence/delivery.json)
- [Reproduction instructions](README.md)

Original source records and captured report bytes retain their original
timestamps/paths. The final evidence-only commit changes Git-count branding;
frozen body, image and renderer hashes identify what was actually captured.
