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
| Dataset detail | 28 characters | Source, mission or instrument shown beside the chooser label |
| Dataset summary | 2 sentences, 125 characters | Fits the three lines the narrowest dataset card reserves |

Each citation names a [source record](../src/sources/) by `catalogueId`, with
the page checked and the date. An optional `quote` of up to 300 characters gives
a reviewer the words to look for, which helps with numbers. The card and the
introduction need at least one citation. A dataset summary may leave out
`sources` when its prepared product already names its inputs; the dataset card
lists those.

The chooser's right-hand label identifies where the dataset comes from: for
example, **Magellan**, **Kaguya MI**, **USGS** or **VLTI/PIONIER**. For a published
model, use the author or archive. Keep explanations of the quantity in the
summary. Members of a group from the same source share
that source label; dates and other differences belong in the arrow selector.

## Satellite-system introductions

Satellite families keep their short introductions in `src/navigation/system-text.json`,
using the same cited text format and introduction limits as bodies. The world
presentation preparer checks every available satellite host and citation, then
publishes the text in `site/prepared-world-presentation.json`. `pnpm prepare:world-context`
refreshes it during development and builds. The shared card header renders it with
the body's introduction typography.

## Overview navigation

Each system lists its prepared orbit members under **Celestial bodies**, using
the same rows as search. The Solar System puts its planets first. Large-scale
overviews use their registry-held groups for navigation: the Milky Way starts
with the Sun and featured stars within its existing galactic range; the Local
Group and Nearby Universe list their held galaxies and clusters.

## Dataset groups

Use the existing arrow selector for related maps that readers will compare:
different dates, wavelength bands, mineral amounts, or components of one field.
Similar colors alone are not a reason to group maps. A photograph, a height map
and an interior model answer different questions and keep separate entries.

In the body's `source/content/object.json`, give consecutive dataset controls the
same `label` and `step.group`, with a distinct `step.label` for each member.
The chooser lists the group once. The selected member supplies its description,
source and legend; the arrows select its neighbors. Each member keeps
its original dataset ID and URL. A date group runs in chronological order;
its existing default can remain a middle member.

For example, the Moon's **Mineral composition** group switches between
plagioclase, olivine and the two pyroxenes. Mars groups five chemical elements;
Pluto groups three modeled ice fractions; Ceres groups two mineral absorption
features. Betelgeuse, CE Tauri and WASP-12b group observations by date. BE Ceti,
χ¹ Orionis, HD 29615 and HD 35296 group three magnetic-field directions.

Keep units and limits beside each map. Mars's thorium scale uses parts per
million while its other element scales use weight percent. Ceres's band depths
are absorption strengths, not mineral percentages. Date selectors do not turn
stellar reconstructions into confirmed images of surface changes.

The short summary should explain the quantity in ordinary words. Keep necessary
scientific names, and explain them when first used. Put full measurement methods,
scale examples and qualifications in the body README and linked source records.
Check the group, arrows, direct links and descriptions at desktop and phone
widths; changing the selected map must retain the mounted scene.

## Publish and check

`node site/build/prepare/prepare-text.mts` checks every body, then writes `prepared/text.json` and the
card into `object.json`. If any body fails validation, it writes nothing. Supply
object IDs to limit publication after the shared validation. A changed card
changes catalogue text; regenerate the catalogues with
`node site/build/prepare/prepare-facilities.mts --catalog-only`. Changed prepared text refreshes the
body inventory and must be published through the usual asset workflow.
`node site/build/prepare/prepare-text.mts --check` verifies without writing.

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
  `node site/build/prepare/prepare-facilities.mts --catalog-only` first.

`site/test/prepare-text.test.mts` runs the check on every registered body.
No repository test measures line wrapping. Inspect affected desktop and phone layouts in a browser
when text or typography changes.
