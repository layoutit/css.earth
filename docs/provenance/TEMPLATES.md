# Writing a body README

The README is the body's source-and-evidence document. A reader should understand
what is shown, where the data came from, what we changed, what was checked and
what remains uncertain without opening several introduction files.

Use sections such as these when they fit:

```markdown
# Body name

Route and a sentence explaining what is shown.

## Sources

Name the dataset behind each view, why it was selected and how it was processed.
Explain units, dates, missing coverage and display changes that affect its meaning.
Link the manifest, credits and detailed source calculations.

## Evidence

State the tested version, method, result and links to the original reports or images.
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
