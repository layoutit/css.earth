# Small documentation examples

Use these where they help. The [contract](CONTRACT.md) does not require new
files or fixed headings for every change.

## Body README

```markdown
# Body name

Route: /body-id/. One sentence describing what is shown.

- [Sources and interpretation](SOURCE.md) · [Credits](NOTICE.md).
- [Test results and known problems](path-to-existing-evidence-note.md).
- [Contributor guide](../README.md).
```

Put detailed instructions and results in linked documents. Link an existing
batch report if it gives a clear result for the body. Add an evidence index only
when several reports need connecting.

## Source update

Explain what changed, which manifest source IDs it uses, why those sources were
chosen and how they were processed. Describe relevant limits: missing coverage,
coordinate assumptions or uncertainty. Link details already written beside the
data. For a value not covered by generated records, name the original field and
calculation. Update NOTICE when credits or terms change. Keep useful alternative
datasets and the reasons they were rejected or remain unresolved.

## Test note

```markdown
# Body or batch: what was checked

Tested version: code revision and links to source/prepared/runtime records.
Include uncommitted changes and ignored or served files used by the test.
For files not fixed by that revision or an existing manifest, record size and hash.

Purpose: the behavior or scientific interpretation being checked.
Method: command, selected cases and environment details that affect the result.
Results: what passed or failed, with links to reports and inspected screenshots.
Not checked: omissions, remaining problems and limits of any reused result.
```

For reproduction, name the expected inventory before the run and compare the
new output against it. For visual checks, save the original images and explain
the comparison. Link committed evidence at a recorded revision; files stored
elsewhere need a stable download location, size and hash.

An old report keeps its original tested version. To reuse a result, explain in
the maintained note which new version it applies to and why.
