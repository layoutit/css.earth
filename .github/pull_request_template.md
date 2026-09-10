<!--
Title: <type>[optional scope][!]: <summary>
Use Conventional Commits 1.0.0: feat(universe): ..., fix: ..., docs: ...
Apply ISO 24495-1:2023 plain language throughout and the repository's PDS4 1.26.0
adaptation to source and processing claims. Replace the prompts below.
Omit Sources and processing when sources, processing and interpretation are unchanged.
-->

## Change

[What was wrong or missing, what now happens, and which bodies or shared components change.]

[Link the updated body README or shared guide when documentation changes.]

## Sources and processing

- **Source:** [Changed provider product/release and link to its maintained source record.]
- **Processing:** [What changed between the input and displayed result.]
- **Meaning and limits:** [Relevant interpretation, coverage or uncertainty; measured versus modeled where it matters.]

## Evidence and limits

Tested revision: [commit or CI run link; identify any relevant uncommitted changes].

- [Command or check] — [result and link to original evidence or inspected images].
- [Relevant failure, check not run or unresolved problem].

<!--
Add only relevant checks. For reused evidence, identify its original revision and
why it still applies. Explain what added evidence or unusually large files support.
Do not repeat source inventories or paste run logs here.
For images, use GitHub attachments or repository URLs pinned to a commit.
Reload the published PR and inspect every image; fix broken embeds before handoff.
If required visual evidence is unavailable, keep the PR in draft and say what is missing.
-->

[PR rules: titles, PDS4 provenance and ISO plain language](https://github.com/layoutit/cssEarth/blob/main/docs/provenance/CONTRACT.md#pull-requests).
