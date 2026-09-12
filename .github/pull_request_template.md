<!--
Title: <type>[optional scope][!]: <summary>
Use Conventional Commits 1.0.0: feat(universe): ..., fix: ..., docs: ...
Apply ISO 24495-1:2023 plain language throughout and the repository's PDS4 1.26.0
adaptation to source and processing claims.
Headings are optional; a small PR can be one paragraph. Delete unused prompts.
Omit Sources and processing when sources, processing and interpretation are unchanged.
-->

## Change

[What was wrong or missing, what now happens, and which bodies or shared components change.]

[Link the updated body README or shared guide when documentation changes.]

## Sources and processing

- **Source:** [Provider product/release and link to its maintained source record.]
- **Processing:** [What changed between the input and displayed result.]
- **Meaning and limits:** [Relevant interpretation, coverage or uncertainty; measured versus modeled where it matters.]

## Evidence and limits

**Proves the change:** [check — result, and why that result is evidence; link the
original evidence or inspected images.]

**Clean:** [checks that only passed, named on one line.]

**Pre-existing, identical on `main`:** [table of unrelated failures; state once that
they match `main`. Cite a standing environment limit rather than re-explaining it.]

[What was not run, and what remains unknown.]

<!--
Add only relevant checks, grouped by what they prove. GitHub already records CI
revisions. For local or reused evidence, name the tested revision and relevant
differences, including uncommitted changes.
Explain why reused evidence still applies and what added evidence or unusually large files support.
Do not repeat source inventories or paste run logs here.
For images, use GitHub attachments or repository URLs pinned to a commit.
For matched visual comparisons, link the retained inputs, Pixelmatch diff at threshold 0.1 and
recorded settings/results required by the provenance contract.
A relative link does not resolve in a PR body; pin repository links to a commit too.
Reload the published PR and inspect every image and link; fix broken ones before handoff.
If required visual evidence is unavailable, keep the PR in draft and say what is missing.
-->

[PR rules: titles, PDS4 provenance and ISO plain language](https://github.com/layoutit/css.earth/blob/main/docs/provenance/CONTRACT.md#pull-requests).
