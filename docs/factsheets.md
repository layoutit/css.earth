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
   A value copied from the body's pinned JPL Horizons record needs no hand-written
   citation: `pnpm cite:facts -- <object-id>` cites `distance-from-sun`,
   `perihelion`, `orbital-period`, `radius` and `rotation-period` from
   `reference/horizons-elements.txt` and `reference/horizons-physical.txt` when
   the displayed value equals the record at its displayed precision. A value that
   differs in any digit came from elsewhere and stays uncited until its author
   names the source; `--check` lists what the tool would cite without writing.
3. Run `pnpm pin:documents -- <object-id>` to re-pin the content in the source
   manifest; the manifest is the only owner of that pin.
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

The facts-only preparer preserves the other content and scene data, and rejects
changed source pins. Card lines, introductions and dataset text are not content:
they live in the body's `text.json` and publish with `pnpm prepare:text`; see
[reader text](reader-text.md). After a lens label change, run the body's content
preparation, then `node tools/prepare-object-json.mts <object-id>` with the
preparation tools built, and refresh provenance with `pnpm prepare:provenance <object-id>`.
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
