# Documentation

For a body's sources, processing, evidence and known problems, read its
`src/planets/<id>/README.md`. Examples: [Earth](../src/planets/earth/README.md),
[Sun](../src/planets/sun/README.md), [Rhea](../src/planets/rhea/README.md) and
[67P](../src/planets/comet-67p/README.md).

## Guides

| Topic | Guide |
| --- | --- |
| Recording sources and evidence | [Provenance contract](provenance/CONTRACT.md) |
| Decoding images, reducing meshes, mapping UVs and baking atlases | [Image and surface preparation](surface-preparation.md) |
| Importing Celestia's native illustrative meshes | [Celestia mesh imports](celestia-meshes.md) |
| Connecting prepared outputs to their inputs | [Prepared object provenance](object-provenance.md) |
| Deriving factsheet values | [Factsheets](factsheets.md) |
| Scene navigation and prepared data | [Navigation ownership](prepared-navigation-ownership.md) |
| Loading objects in the browser | [Page navigation transport](page-navigation-transport.md) |
| Changing objects and cancelling a flight | [Flight lifecycle](flight-lifecycle.md) |
| TypeScript owners, JavaScript exceptions and checks | [TypeScript ownership](architecture/typescript-ownership.md) |
| Page titles, descriptions and search indexing | [SEO](seo.md) |

For contribution steps, use the [body contributor guide](../src/planets/README.md).
[AGENTS.md](../AGENTS.md) sets application rules; the
[celestial skill](../.agents/skills/celestial-skill/SKILL.md) points agents to the
same workflow and implementation.

## Proposals under discussion

- [SOURCES catalogue](architecture/sources-catalogue-proposal.md) — canonical source identity, local evidence, derived usage and migration.
- [Missions, spacecraft and dataset attribution](architecture/exploration-catalog.md) — catalogue ownership, capture migration, preparation and dataset navigation.
- [Spacecraft and individual mission catalogues](architecture/spacecraft-missions-proposal.md)

## Where work belongs

Keep maintained Markdown guides here and their illustrations in `images/`.
Link each guide from this index or another guide, and each illustration from a
guide. Put processing code in `tools/`, test fixtures in `tests/`, and source
identities beside the body.
Link historical evidence at its exact Git revision from the account that uses it.
Plans, superseded proposals and raw run output do not need a permanent copy in
the current tree.

Update the affected guide or body README in the same PR as the change. Use the
[PR template](../.github/pull_request_template.md) for the result and checks;
do not add a separate completion report to `docs/`.

CI checks local Markdown, reference and HTML links, heading anchors, file placement
and links from this index.
It also rejects duplicate body `SOURCE.md`, `EVIDENCE.md` and `USAGE.md` accounts.
Run the same check with
`python3 tools/audits/check-documentation-links.py --all`.

For a Git snapshot inventory of body records, retained HTML and duplicate bytes,
run `python3 tools/audits/provenance-documentation-inventory.py --repo . --ref HEAD --output /tmp/provenance-inventory.json`.
This reads committed files; add `--index` to include the staged change. It does
not acquire sources or qualify scientific claims.

- [Sources catalogue](sources-catalogue.md): published identities, bindings, preparation and coverage.
