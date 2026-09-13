# Object bibliography

[Catalogue → Papers](http://127.0.0.1:4331/catalogue?object=m42&view=papers) browses references for all 110 Messier objects. Search titles, abstracts, DOIs and bibcodes; filter by topic and earliest year. The default prioritizes titles naming the object or a catalogue alias, then orders by year. Abstracts expand locally. Publisher, ADS and SIMBAD links open source records; arXiv links appear only for recoverable arXiv identifiers. ADS supplies other full-text options. Browsing downloads no PDFs and starts no reconstruction.

## Source and meaning

Acquisition joins canonical SIMBAD `ident.id` through `has_ref` to `ref`, using explicit object associations rather than ambiguous name searches. Padded identifiers remain intact. Indexed article object names (`ref_raw_id`) stay in the records and SIMBAD link tooltips. Missing journals, DOIs and abstracts remain missing. The query supplies no author list. Abstracts preserve source notation, including some TeX-like markup.

Source: [CDS SIMBAD bibliography](https://simbad.cds.unistra.fr/Pages/guide/ch15.htx), Strasbourg; [Wenger et al. (2000)](https://doi.org/10.1051/aas:2000332). Respect [SIMBAD's ODbL database terms](https://simbad.unistra.fr/simbad/) and original publishers' rights in abstracts/papers. This is a local discovery cache, not a republished full-text collection.

Associations include passing mentions and large surveys. Topic tags are keyword matches, **not validated measurements or accepted reconstruction constraints**. Read each paper and record its actual frames, uncertainties and assumptions in the relevant nebula recipe before modeling. References follow the specific SIMBAD identity: some Messier nebula entries identify associated clusters; M102 retains the adopted NGC 5866 identification. Existing identity qualifications remain visible. SIMBAD's indexed references are not an exhaustive bibliography of every surrounding region or component.

## Acquire or resume from a clean checkout

Run from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/src/run.ts acquire-messier-presentation
node --experimental-strip-types labs/nebula/src/run.ts acquire-messier-papers
pnpm lab:nebula
```

The papers command validates and resumes caches without an ADS token. `--object=m42` limits acquisition; `--refresh` re-queries selected objects and counts. Leave an already-running lab running, then press **Reload papers**. Existing image processing and camera state are independent.

## Storage and integrity

- Ignored cache: `.local/nebula-lab/catalogue/messier/papers/`. The index binds to the tracked object catalogue hash. Exact TAP responses, queries, digests and retrieval dates provide source receipts.
- Content-addressed object pages use `.json.gzip`. This avoids the development server's automatic HTTP decompression of `.json.gz`: the browser must verify compressed bytes and size before explicit decompression and object/count checks.
- Only the selected object's page loads. A single sequential writer publishes the index atomically; immutable pages preserve existing readers.
- The query requests the counted total plus one, capped at 50,000 rows per object. `complete` requires matching counts; changes, caps and overflow yield `partial`. Failures remain visible and resumable.
- Initial 2026-09-13 snapshot: **157,321 object–reference associations**, **67,249 distinct bibcodes**, **44,232 distinct records with abstracts**, **110/110 objects**, publication years **1850–2026**. Browser pages total **61,921,211 compressed bytes**; receipts and index bring the full cache to approximately **123 MB**. These are snapshot figures, not PDF sizes.

## Ownership and checks

`src/catalogue/papers/` owns schemas, acquisition, selection, transport and the React panel/styles. The existing catalogue owns object selection and `view=papers` URLs.

The `papers` tests cover identities, query escaping, missing fields, title/topic ordering, links and integrity failures. `browser-catalogue-papers` exercises actual M42/M31/M40 references, abstracts, filters, URL persistence, compact layout, corrupted pages and missing indexes, with no PDF downloads or processing requests. Lab typechecking and build cover integration. These verify bibliography browsing, not the scientific validity of individual claims.
