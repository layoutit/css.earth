# Factsheet conventions

Facts belong to each object's authored content and are published as prepared
text. They do not configure rendering, geometry, simulation or camera scale.

## Measurements and sources

- Use **mean radius** for planetary size, following [JPL's physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html).
  Keep equatorial, model/reference and three-axis dimensions explicitly labeled.
- **Solar semimajor axis** is the rounded J2000 scale from
  [JPL Table 1](https://ssd.jpl.nasa.gov/planets/approx_pos.html), whose fitted elements
  cover 1800–2050. It is neither current nor time-averaged distance. Show a moon's
  own orbit before its parent planet's solar orbit.
- Orbital and rotation periods are sidereal. Mark retrograde rotation and retain
  qualifiers such as synchronous, assumed synchronous and chaotic.
- Preserve source units, precision and uncertainty. Giant-planet gravity refers
  to a specified atmospheric level. [JPL's satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/)
  supplies moon measurements; do not fill gaps with assumed properties or relabel
  a shape-model reference radius as a measured mean radius.
- Moon counts need a source and checked date. Wind speeds, temperatures and ring
  dimensions retain their measurement scope and approximate/maximum qualifiers.

## Corrections requiring care

Check angle units and spin-axis conventions before comparing axial tilts. Keep
solar activity and complete magnetic cycles distinct, and specify latitude for
differential rotation. The [September 2026 source review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/factsheets.md#corrections-requiring-care)
retains the selected values, source-access limits and the original pass's
uncertainty threshold; those dated selections are not a current catalogue.

## Editing and reproduction

1. Edit `panel.facts`/`panel.moreFacts` in the content source referenced by
   `object.json`. Use stable semantic IDs, units and meaningful precision.
2. Cite the source on the fact itself. `fact.source` records `catalogueId`, URL,
   label, checked date, and a locator such as a table row or model parameter.
   Reuse the [published source identity](sources-catalogue.md#add-or-update-a-source).
   For extracted values, also set `path` to the existing pinned evidence, or
   `source/editorial/factsheet-review.json`, and pin that file in the manifest.
   Keep the source units, uncertainty and any calculation in that record.
3. Update the content SHA-256 in the descriptor and source manifest, and its
   `expectedBytes` in the manifest.
4. Run `pnpm prepare:factsheets -- <object-id>` to publish facts and refresh their
   preparation references. Add `--check` to verify without writing; omit the ID
   only when intentionally processing all bodies.

Full preparation, facts-only edits and Sources use the same citation checks:
valid dates and web URLs, unique fact IDs, and matching bytes for local evidence.
Each fact names its own source even when several references share one evidence
file. A source on one fact does not support its neighbors. Sources checks the
canonical IDs and that published facts match the authored content, then includes
the cited facts in the prepared source catalogue. The dataset's Sources card
shows product citations, not this factsheet index. Preparation reports how many
facts still lack individual citations; those facts acquire no inferred source.

The facts-only preparer preserves the other content and scene data. It also
rejects changed source pins and an introduction mismatch. For introduction and
lens prose or label changes, use
`pnpm prepare:factsheets -- --editorial <object-id>`; add `--check` for verification.
After writing editorial changes, run `node tools/prepare-object-json.mts <object-id>`
with the preparation tools built to publish the scene transport and page controls.
Refresh source provenance with `pnpm prepare:provenance <object-id>`.
Imagery, legends, charts, settings, numeric scene data and lens inventory changes
still require their preparation owners. Shared ordering keeps four initial rows
and the View more/View less disclosure.

## Checks

```sh
pnpm test:sources
```

For changes to ordering or display, also run the affected factsheet and shell
tests. Browser checks should include long values and narrow viewports at DPR 1 and 2:
readable labels, contained rows, four-row previews and both disclosure directions.
Include the body classes affected by the change. These checks do not replace
renderer, asset or scientific qualification.
