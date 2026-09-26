# Reader text

A body's card line, introduction and dataset text live in its `text.json`,
next to `object.json`. The file is outside `source/`, so changing words never
changes the source recipes or adds source-manifest pins. Publishing text still
updates its prepared output and delivery inventory.

## The file

```json
{
  "schema": "cssearth-object-text@1",
  "objectId": "tethys",
  "card": { "text": "…", "sources": [{ "catalogueId": "nasa-saturn-moons", "url": "…", "label": "…", "checked": "2026-09-13" }] },
  "introduction": { "text": "…", "sources": [{ "…": "…" }] },
  "datasets": { "<dataset id>": { "title": "…", "detail": "…", "summary": "…" } }
}
```

| Block | Limit | Notes |
| --- | --- | --- |
| Card | 1 sentence, 110 characters | Also the catalogue description used by search, previews and sharing |
| Introduction | 2 sentences, 180 characters | Say something about the body that its mission and dataset cards do not |
| Dataset title | 40 characters | Specific to the product, not the chooser label |
| Dataset detail | 28 characters | Optional chooser subtitle |
| Dataset summary | 2 sentences, 125 characters | Fits the three lines the narrowest dataset card reserves |

Each citation names a [source record](../src/sources/) by `catalogueId`, with
the page checked and the date. An optional `quote` of up to 300 characters gives
a reviewer the words to look for, which helps with numbers. The card and the
introduction need at least one citation. A dataset summary may leave out
`sources` when its prepared product already names its inputs; the dataset card
lists those.

## Publish and check

`node tools/prepare/cli/prepare-text.mts` checks every body, then writes `prepared/text.json` and the
card into `object.json`. If any body fails validation, it writes nothing. Supply
object IDs to limit publication after the shared validation. A changed card
changes catalogue text; regenerate catalogue/provenance with
`node tools/prepare/cli/prepare-provenance.mts`. Changed prepared text refreshes the
body inventory and must be published through the usual asset workflow.
`node tools/prepare/cli/prepare-text.mts --check` verifies without writing.

These errors block publication:

- a dataset without text, or text for a dataset the body does not have;
- a block over its limit, or a sentence block without a full stop;
- a citation that names no source record;
- a dataset summary without sources whose product names no inputs.

Warnings are for the reviewer and never block:

- filler such as "explore" or "in 3D", and process words such as "prepared";
- words about the display in the card or introduction, such as "model" or "mesh";
- "grid", which the dataset legend explains;
- a title that repeats the chooser label, or a sentence used twice;
- a card or introduction that another body shares;
- repetition between blocks shown together: the introduction, one dataset
  summary and the mission, facility and note cards beside it. This check reads
  `site/prepared-facilities.json`, so run
  `node tools/prepare/cli/prepare-facilities.mts --catalog-only` first.

`tools/prepare/prepare-text.test.mts` runs the check on every registered body.
`site/test/rendered-page.test.mts` checks scene invariants in built HTML; it does
not measure line wrapping. Inspect affected desktop and phone layouts in a browser
when text or typography changes.
