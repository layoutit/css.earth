# Retrieved temperature–pressure chart recipe

Part of the [scientific chart recipes catalog](chart-recipes.md).

Use `kind: "retrieved-profile"` in an object's `source/content/charts.json` to
compare one to three atmospheric temperature profiles with credible intervals.
The shared preparer produces one SVG for the existing Charts panel. It draws
no sample nodes in the application's DOM and needs no browser plotting code.

The working example is [WASP-18b's recipe](../src/objects/wasp-18b/source/content/charts.json).
Its [body README](../src/objects/wasp-18b/README.md) records the source meanings
and independent scientific checks. Reuse the recipe structure and supply the
new body's sources, labels and ranges; keep its science in its own package.

## Presentation

- Temperature runs left to right in kelvin; pressure increases downward on a
  logarithmic axis in bar. Lower pressure is labelled as higher atmosphere.
- Each profile has a median line and a translucent band between the published
  lower and upper credible bounds. The second profile uses a dashed line as
  well as a different color. The legend identifies each fit.
- Two horizontal dashed lines mark the pressure range primarily probed by the
  observation. The recipe must cite evidence for those bounds.
- Up to four short notes explain what the fits, bands and marked range mean.
  The image title and alt text provide a fuller accessible description.
- The viewBox is 306 units wide. Its height is
  `260 + 17 × series count + 15 × note count`; three profiles and four notes
  use 306 × 371. The existing panel scales this image on desktop and mobile.

## Recipe fields

The surrounding document uses `schema: "cssearth-chart-assets@1"`, the body's
`publicBase`, and a `charts` array. Each retrieved-profile entry supplies:

| Field | Meaning |
| --- | --- |
| `id`, `title`, `description`, `output` | Chart identity, accessible text and relative output filename. |
| `metadata` | Paper and deposit identities, observation, quantity, uncertainty definition and processing notes, embedded in the SVG. |
| `series` | One to three table definitions, in legend order. |
| `series[].path` | Input path relative to the body's `source/` directory. |
| `series[].label`, `color` | Legend label (up to 38 characters) and six-digit hex color. |
| `series[].pressureUnit` | Exactly `Pa` or `bar`; Pa is divided by 100,000. |
| `series[].expectedRows` | Published native row count, checked before cropping. |
| `series[].columns` | Zero-based `pressure`, `median`, `lower`, `upper` column indices. Temperatures are in kelvin. |
| `pressure`, `temperature` | Positive increasing `minimum`, `maximum`, and sorted `ticks` containing numeric `value` and display `label`. |
| `probedPressure` | Positive `minimum` and `maximum` in bar, inside the plotted range. |
| `notes` | Up to four lines of up to 49 characters each. |

Tables are whitespace-delimited numerical text. Blank lines and `#` comments
are ignored. Pressure must be strictly monotonic; ascending and descending
files are both supported. Bounds are **absolute temperatures**, not positive
and negative errors to add to the median. Use the same credible probability
for all profiles and say what it is in the notes.

The preparer retains native samples inside the pressure window, connects them
linearly in log-pressure and interpolates only the two window crossings.
It refuses extrapolation, non-finite samples, inverted quantiles and an axis
that would clip a displayed uncertainty band. It performs no atmospheric fit.

## Connect it to an object

1. Preserve or make the source tables restorable. Declare their paths, source
   bindings, credits and acquisition routes in the body's manifest.
2. Register the `charts` recipe and preparation step in the object descriptor.
   Declare `content/charts.json` as an authored manifest document.
3. Add the prepared image to `source/content/object.json`'s `charts` list with
   its URL, dimensions, alt text and source reference. WASP-18b demonstrates
   the existing `temperaturePressure` title key.
4. Prepare through the normal authored-object pipeline. For an unchanged
   image bank, use its supported `--reuse-images` route and declare the changed
   recipe ids. Regenerate provenance: each series table must appear as an
   input to the chart product.
5. Check the units and several independent values against the original paper;
   inspect the mounted panel on desktop and mobile. Publish the changed
   inventory through the [prepared-asset workflow](../CONTRIBUTING.md#publishing-prepared-assets-maintainers).

The implementation is [retrieved-profile.ts](../packages/bake/src/objects/charts/retrieved-profile.ts),
dispatched by [charts.ts](../tools/objects/charts/charts.ts). Its focused check is
`node --test tests/objects/charts/retrieved-profile.test.mts`.
It covers pressure conversion, interval interpretation, independent figure
anchors, invalid inputs and the three-table provenance binding. An added body
needs its own reference values; WASP-18b's anchors do not qualify another fit.
