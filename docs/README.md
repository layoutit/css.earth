# Documentation

For a body's sources, processing, evidence and known problems, read its
`src/objects/<id>/README.md`. Examples: [Earth](../src/objects/earth/README.md),
[Sun](../src/objects/sun/README.md), [Rhea](../src/objects/rhea/README.md) and
[67P](../src/objects/comet-67p/README.md).

## Guides

| Topic | Guide |
| --- | --- |
| PR feedback budget, check selection, failure recovery and deployment | [CI/CD maintenance](ci-cd.md) |
| Galaxies, LMC image lenses and extragalactic datasets | [Galaxies and the nearby universe](galaxies/README.md) |
| Nebula reconstruction, spectral lenses and reproducible delivery | [Prepared nebulae](nebulae/README.md) |
| Recording sources and evidence | [Provenance contract](provenance/CONTRACT.md) |
| Catalog-wide image-to-shape faithfulness review | [Surface-registration review](provenance/surface-registration-review.md) |
| Decoding images, reducing meshes, mapping UVs and baking atlases | [Image and surface preparation](surface-preparation.md) |
| Interferometric data to star surfaces: calibration, reconstruction and the checks | [Interferometric imaging](interferometric-imaging.md) |
| What the open archives hold for our bodies, by name | [Archive screen](archive-screen.md) |
| Drawing an opaque body inside a prepared volume: a proposal and its measurements | [A body inside a volume](mesh-in-volume.md) |
| Pinning an observation, re-running the observatory's own software, and what each kind of check establishes | [Virtual telescopes](virtual-telescopes.md) |
| Querying VO archives, selecting bounded science products and retaining acquisition evidence | [VO observation access](vo-observation-access.md) |
| Which upstream packages own a mechanical boundary here, and which contracts stay ours | [Astronomy package ownership](astronomy-package-ownership.md) |
| One example picture per telescope, each made from a product that telescope's toolkit produced here | [Telescope examples](telescope-examples.md) |
| Pinned sources, public commands and retained outputs for the 18 telescope data families | [Telescope family examples](telescope-family-examples/README.md) |
| Exoplanet light curves to maps: eigencurve fitting and its checks | [Eclipse mapping](eclipse-mapping.md) |
| JWST images to sky band composites: MAST programs, the re-run level-3 stage, its oracle and depth from a model | [JWST imaging](jwst-imaging.md) |
| What JWST's public archive holds by observing mode, what this project can already reduce, and which shipped objects JWST has observed | [JWST ledger](jwst-ledger.md) |
| Hubble observations re-calibrated from raw on the instrument's own pipeline, and checked against the archive's own product | [Hubble](hubble.md) |
| What Hubble's public archive holds by instrument, how much of it this project can re-calibrate, and which shipped objects Hubble has observed | [Hubble ledger](hubble-ledger.md) |
| VLT/NACO raw frames re-reduced on ESO's own pipeline, and why its check can only be internal | [VLT/NACO](naco.md) |
| What the NACO archive holds for this project's bodies, and which modes are reduced | [NACO archive ledger](naco-ledger.md) |
| Chandra observations reprocessed from level 1 on the observatory's own software, and checked event by event against the archive's own product | [Chandra](chandra.md) |
| What the Chandra archive holds, which of our objects it observed, and how far the toolkit is proved | [Chandra archive ledger](chandra-ledger.md) |
| Spitzer/IRAC mosaics re-made from the archive's own level-1 frames, why the observatory's MOPEX would not run here, and how close an open re-mosaic gets | [Spitzer](spitzer.md) |
| What the Spitzer archive holds for our objects by observing mode, and which of them this toolkit has checked | [Spitzer archive ledger](spitzer-ledger.md) |
| The complete IHW/PDS near-nucleus Halley index and one qualified archive-final image | [IHW/PDS Halley](ihw-halley.md) |
| JunoCam's push-frame images cast strip by strip from the Juno kernels, the limb fit of their two epochs, and what the four Europa images measured | [JunoCam](junocam.md) |
| What the JunoCam archive holds, which of our objects it photographed, and which images are measured or cast | [JunoCam archive ledger](junocam-ledger.md) |
| Keck observations pinned from KOA, re-reduced on the archive's own pipeline, and checked against the archive's own cube | [Keck](keck.md) |
| What the Keck archive holds by instrument for this project's objects, and what can be re-reduced here | [What Keck holds](keck-ledger.md) |
| Gemini raw frames re-reduced on DRAGONS: the CADC route, the archive's own calibration association, and what agrees | [Gemini Observatory](gemini.md) |
| What the Gemini archive holds for our bodies, by instrument, and what this toolkit has proven | [Gemini ledger](gemini-ledger.md) |
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
| What the open archives hold for our catalogued bodies | [Archive screen](archive-screen.md) |
| Facility model thumbnails: sources and appearance | [Facility thumbnails](facility-thumbnails.md) |
| Moon sidebar listing, labels and orbit registration | [Moon catalogues](moon-catalogues.md) |
| Scroll-driven camera distance experiment | [Native scroll zoom experiment](native-scroll-zoom.md) |
| Choosing which destinations get featured or captioned | [Choosing destinations to explore](object-discovery.md) |
| The shared neutral shape-only display material | [Shape-only material](shape-only-material.md) |
| Sidebar row thumbnails for galaxies, nebulae and datasets | [Sidebar thumbnails](sidebar-thumbnails.md) |
| Scene caption policy for the universe view | [Universe labels](universe-labels.md) |

For contribution steps, use the [body contributor guide](../src/objects/README.md).
[AGENTS.md](../AGENTS.md) sets application rules; the
[celestial skill](../.agents/skills/celestial-skill/SKILL.md) points agents to the
same workflow and implementation.

## Where work belongs

Keep maintained Markdown guides here and their illustrations in `images/`.
Link each guide from this index or another guide, and each illustration from a
guide. Put processing code in `tools/`, test fixtures in `tests/`, and local source
records beside the body. Shared published identities belong in the Sources catalogue.
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
`node tools/audits/check-documentation-links.mts --all`.

For a Git snapshot inventory of body records, retained HTML and duplicate bytes,
run `python3 tools/audits/provenance-documentation-inventory.py --repo . --ref HEAD --output /tmp/provenance-inventory.json`.
This reads committed files; add `--index` to include the staged change. It does
not acquire sources or qualify scientific claims.
