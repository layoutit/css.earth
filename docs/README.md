# Documentation map

Start with [AGENTS.md](../AGENTS.md), the
[body contributor guide](../src/planets/README.md), the
[provenance contract](provenance/CONTRACT.md) and the
[celestial skill](../.agents/skills/celestial-skill/SKILL.md).

| Looking for | Read |
| --- | --- |
| Sources, processing, test results and known problems | The body’s `README.md`, with links to substantial methods and original reports |
| Credits and reuse terms | Body `NOTICE.md`, license files and source manifest |
| Image decoding, UV mapping, mesh reduction and texture atlases | [Image and surface preparation](surface-preparation.md) |
| How outputs trace back to inputs, including the Sources UI | [Prepared object provenance](object-provenance.md) |
| Saving original reports and screenshots | [Evidence rules](provenance/CONTRACT.md#save-enough-evidence-to-check-the-result) |
| Code to prepare a new kind of data | [Celestial implementation map](../.agents/skills/celestial-skill/references/implementation-map.md) |
| Documentation audit and reviews | [Initial audit and committed-file cleanup](provenance/audits/2026-09-09/AUDIT.md), [review and completed migration](provenance/audits/2026-09-09/ADVERSARIAL-REVIEW.md#complete-migration-and-final-review) |

Reports elsewhere in `docs/` keep their original dates, tested versions and limits.
A filename containing `final` or an old passing result does not show that today's
checkout passes. The shared-runtime proposal, implementation and proof describe
an earlier eleven-object version. Use the implementation map above for current
code ownership. Link original reports rather than copying them.

The four body README examples are [Earth](../src/planets/earth/README.md),
[Sun](../src/planets/sun/README.md), [Rhea](../src/planets/rhea/README.md) and
[67P](../src/planets/comet-67p/README.md).

Check changed local links with
`python3 tools/audits/check-documentation-links.py --base <review-base>`.
It supports sparse checkouts and checks file paths and heading anchors.
It does not check external URLs or scientific claims.
