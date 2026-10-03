# Documentation

For a body's sources, processing, evidence and known problems, read its
`src/objects/<id>/README.md`. Examples: [Earth](../src/objects/earth/README.md),
[Sun](../src/objects/sun/README.md), [Rhea](../src/objects/rhea/README.md) and
[67P](../src/objects/comet-67p/README.md).

## Guides

| Topic | Guide |
| --- | --- |
| Computed schema ownership across packages and architecture locks | [Prepared format ownership](prepared-format-ownership.md) |
| PR feedback budget, check selection, failure recovery and deployment | [CI/CD maintenance](ci-cd.md) |
| Galaxies, LMC image datasets and extragalactic datasets | [Galaxies and the nearby universe](galaxies/README.md) |
| Nebula reconstruction, spectral datasets and reproducible delivery | [Prepared nebulae](nebulae/README.md) |
| The Messier catalogue: clusters as member stars, galaxies and nebulae as pictures | [The Messier catalogue](messier/README.md) |
| Recording sources and evidence | [Provenance contract](provenance/CONTRACT.md) |
| Catalog-wide image-to-shape faithfulness review | [Surface-registration review](provenance/surface-registration-review.md) |
| Decoding images, reducing meshes, mapping UVs and baking atlases | [Image and surface preparation](surface-preparation.md) |
| Compact numeric USGS maps for the Moon, Venus, Mercury and Mars | [Numeric USGS surface maps](usgs-numeric-surfaces.md) |
| Interferometric data to star surfaces | [Interferometric imaging](interferometric-imaging.md) |
| What the open archives hold for our catalogued bodies, by name | [Archive screen](archive-screen.md) |
| Drawing an opaque body inside a prepared volume | [A body inside a volume](mesh-in-volume.md) |
| Telescope CLI setup, saved queries and outputs | [Telescope command guide](../packages/telescope-cli/README.md) |
| Pinning an observation and re-running the observatory's own software | [Virtual telescopes](virtual-telescopes.md) |
| Querying VO archives and selecting science products | [VO observation access](vo-observation-access.md) |
| Which upstream packages own a mechanical boundary here | [Astronomy package ownership](astronomy-package-ownership.md) |
| One example picture per telescope | [Telescope examples](telescope-examples.md) |
| Pinned sources, commands and outputs for the 18 telescope data families | [Telescope family examples](telescope-family-examples/README.md) |
| Exoplanet light curves to maps | [Eclipse mapping](eclipse-mapping.md) |
| JWST images to sky band composites | [JWST imaging](jwst-imaging.md) |
| What JWST's public archive holds and what this project can reduce | [JWST ledger](jwst-ledger.md) |
| Hubble observations re-calibrated from raw and checked against the archive | [Hubble](hubble.md) |
| What Hubble's public archive holds and what this project can re-calibrate | [Hubble ledger](hubble-ledger.md) |
| VLT/NACO raw frames re-reduced on ESO's own pipeline | [VLT/NACO](naco.md) |
| What the NACO archive holds for this project's bodies | [NACO archive ledger](naco-ledger.md) |
| Chandra observations reprocessed from level 1 and checked against the archive | [Chandra](chandra.md) |
| What the Chandra archive holds for our objects | [Chandra archive ledger](chandra-ledger.md) |
| Spitzer/IRAC mosaics re-made from level-1 frames | [Spitzer](spitzer.md) |
| What the Spitzer archive holds for our objects | [Spitzer archive ledger](spitzer-ledger.md) |
| The IHW/PDS near-nucleus Halley index | [IHW/PDS Halley](ihw-halley.md) |
| JunoCam push-frame images cast from the Juno kernels | [JunoCam](junocam.md) |
| What the JunoCam archive holds for our objects | [JunoCam archive ledger](junocam-ledger.md) |
| Keck observations re-reduced on the archive's own pipeline | [Keck](keck.md) |
| What the Keck archive holds for this project's objects | [What Keck holds](keck-ledger.md) |
| Gemini raw frames re-reduced on DRAGONS | [Gemini Observatory](gemini.md) |
| What the Gemini archive holds for our bodies | [Gemini ledger](gemini-ledger.md) |
| Connecting prepared outputs to their inputs | [Prepared object provenance](object-provenance.md) |
| Published source identities, input bindings and usage links | [Sources catalogue](sources-catalogue.md) |
| Missions, spacecraft and dataset attribution | [Exploration catalogue](architecture/exploration-catalog.md) |
| Deriving factsheet values | [Factsheets](factsheets.md) |
| Scene navigation and prepared data | [Navigation ownership](prepared-navigation-ownership.md) |
| Loading objects in the browser | [Page navigation transport](page-navigation-transport.md) |
| Changing objects and cancelling a flight | [Flight lifecycle](flight-lifecycle.md) |
| Measured renderer and navigation performance work | [Performance notes](performance/README.md) |
| TypeScript owners, JavaScript exceptions and checks | [TypeScript ownership](architecture/typescript-ownership.md) |
| Page titles, descriptions and search indexing | [SEO](seo.md) |
| Facility thumbnails: NASA artwork, photographs and model renders | [Facility thumbnails](facility-thumbnails.md) |
| Moon sidebar listing, labels and orbit registration | [Moon catalogues](moon-catalogues.md) |
| Explicit system cards for bodies with prepared moons | [Satellite-system navigation](satellite-system-navigation.md) |
| Scroll-driven camera distance experiment | [Native scroll zoom experiment](native-scroll-zoom.md) |
| Choosing which destinations get featured or captioned | [Choosing destinations to explore](object-discovery.md) |
| The shared neutral shape-only display material | [Shape-only material](shape-only-material.md) |
| Sidebar row thumbnails for galaxies, nebulae and datasets | [Sidebar thumbnails](sidebar-thumbnails.md) |
| Scene caption policy for the universe view | [Universe labels](universe-labels.md) |

For contribution steps, use the [body contributor guide](../src/objects/README.md).
[AGENTS.md](../AGENTS.md) sets application rules; the
[celestial skill](../.agents/skills/celestial-skill/SKILL.md) points agents to the
same workflow.

## Where work belongs

Keep maintained Markdown guides here and their illustrations in `images/`.
Link each guide from this index or another guide, and each illustration from a
guide. Put preparation code in `packages/bake` (`src/<topic>/`, `cli/`, `authoring/<body>/`), telescope work in `packages/telescope-cli`, site-only build steps in `site/build/`, CI checks in `.github/scripts/`, experiments in `labs/`, unit tests, fixtures and helpers beside their code; integration tests in `integration/`, and local source
records beside the body. Shared published identities belong in the Sources catalogue.
Git history keeps removed evidence; never link it by commit.
Plans, superseded proposals and raw run output do not need a permanent copy in
the current tree.

Update the affected guide or body README in the same PR as the change. Use the
[PR template](../.github/pull_request_template.md) for the result and checks; do not add a completion report to `docs/`.

CI checks local Markdown, reference and HTML links, heading anchors, file placement and links from this index. It also
rejects duplicate body `SOURCE.md`, `EVIDENCE.md` and `USAGE.md` accounts. Run the same check with
`node .github/scripts/audits/check-documentation-links.mts --all`.

For a Git snapshot inventory of body records, retained HTML and duplicate bytes, run
`python3 .github/scripts/audits/provenance-documentation-inventory.py --repo . --ref HEAD --output /tmp/provenance-inventory.json`.
It reads committed files; add `--index` to include the staged change. It does not acquire sources or qualify scientific
claims.
