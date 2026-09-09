# Documentation map

Start with the [project contract](../AGENTS.md),
[body contributor guide](../src/planets/README.md),
[provenance/documentation contract](provenance/CONTRACT.md) and
[celestial skill](../.agents/skills/celestial-skill/SKILL.md).

| Need | Maintained owner |
| --- | --- |
| Source choices, interpretation and candidate datasets | Each body's `SOURCE.md` and linked source notes |
| Credits and reuse terms | Body `NOTICE.md`, license files and source-manifest entries |
| Exact product lineage and Sources UI | [Prepared object provenance](object-provenance.md) |
| Evidence organization and current limitations | [Evidence index](evidence/README.md), then the body's README |
| Extending a preparation capability | [Celestial implementation map](../.agents/skills/celestial-skill/references/implementation-map.md) and actual shared code |
| Documentation audit and rollout | [Provenance owner](provenance/README.md) |

The rest of `docs/` includes subject guides, proposed architectures and historical
batch/review records. Their date, tested commit and stated scope matter. A file
called `final`, a merged PR, or an old passing report does not certify today's
checkout. Preserve original evidence; link and qualify it instead of copying it.

Body entry-point pilots: [Earth](../src/planets/earth/README.md),
[Sun](../src/planets/sun/README.md), [Rhea](../src/planets/rhea/README.md),
[67P](../src/planets/comet-67p/README.md). Other packages migrate as they are
next touched; absence of a new entry point is documentation debt, not a new
decision about whether the body can render.

Validate changed local links with
`python3 tools/audits/check-documentation-links.py --base <review-base>`.
The checker works with sparse checkouts and checks repository paths and heading
anchors; it does not verify external URLs or scientific claims.
