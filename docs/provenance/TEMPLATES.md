# Writing a body README

The README is the body's source-and-evidence document. A reader should understand
what is shown, where the data came from, what we changed, what was checked and
what remains uncertain without opening several introduction files.

Use the [standards mapping](CONTRACT.md#standards-basis) once, in the shared
contract. Keep each body README focused on its own data. Use sections like these:

```markdown
# Body name

Route and a sentence explaining what is shown.

## Sources

Name the provider and dataset behind each view, its published identifier/version,
why it was selected and its supplied processing level when available. Separate
upstream processing from our calculations and display changes. Explain the units,
observation dates, coordinate conventions and missing coverage that matter.
Link the manifest, credits and detailed source calculations.

## Evidence

State the tested version, method, result and links to the original reports or images.
Distinguish file/metadata checks, scientific checks and browser/visual results.
Explain what a reused result still covers. Record failures and tests not run.

## Known problems

List unresolved source, processing, evidence or display problems.
```

The actual examples are [67P](../../src/planets/comet-67p/README.md),
[Earth](../../src/planets/earth/README.md), [Sun](../../src/planets/sun/README.md)
and [Rhea](../../src/planets/rhea/README.md).

Keep exact file sizes and hashes in existing manifests. Link detailed source
notes instead of copying their calculations. Preserve original test reports;
the README summarizes their results and names the versions they tested.
Installation, common controls and preparation commands belong in the shared
repository guides.

Follow the [contract](CONTRACT.md) for identifying uncommitted or ignored files,
reproduction comparisons, visual evidence and reuse of old results.
