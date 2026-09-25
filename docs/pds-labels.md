# PDS labels in preparation

The shared [label helpers](../packages/telescope/src/pds-labels.ts) in `@cssearth/telescope` read metadata used by
image decoders and camera preparation. They do not decode image bytes or replace
the product's identity, projection, calibration and source-hash checks.

## PDS3 keyword selection

`pds3Values(label, key)` returns a scalar as a one-item array or the members of a
flat sequence/set. `pds3Keyword` joins those values with commas for existing recipe
comparisons. Without a scope, a keyword must occur exactly once across the label;
multiple occurrences fail, even if their values agree. Missing fields return
`undefined`. To select a field deliberately:

```ts
pds3Keyword(label, 'TARGET_NAME', []); // root only
pds3Keyword(label, 'SAMPLE_BITS', ['IMAGE']); // direct IMAGE attribute
pds3Values(label, 'FILTER_NAME', ['IMAGE', 'CAMERA']); // nested scope
```

Repeated scope names are ambiguous; the reader never chooses the first object.
It separates OBJECT/GROUP nesting, quoted text, flat lists and comments. Keyword-like
lines inside descriptions or comments are not attributes. It stops at `END` and
also accepts balanced label fragments without an `END` statement.

Values remain text: numeric units and quoted line breaks are preserved, and dates
are not converted. Only selected values are interpreted; an unrelated unsupported
value does not prevent reading an observation's identity. Nested selected lists,
empty list members, malformed scope boundaries and unfinished quotes fail.
The reader limits input to 8,388,608 JavaScript characters and nesting to 64 levels.
It does not expand `^STRUCTURE`, normalize multiline prose or implement all PVL
value types. PDS3 comments ignore the rest of their physical line; multiline
comment blocks are also accepted for archive compatibility.

These choices follow the statement, aggregation and value distinctions in
[PDS3 Standards Reference 3.8, chapter 12](https://pds.nasa.gov/datastandards/pds3/standards/sr/Chapter12.pdf),
especially sections 12.4.1–12.4.5. This is a bounded preparation reader, not an
archive-conformance validator.

## Calibration text is an explicit archive convention

Cassini RMS labels retain CISSCAL's `UNITS = 'I/F'` inside the root `DESCRIPTION`.
The [calibrated-colour check](../tools/objects/surface-observations/formats/pds3-reflectance.mts)
reads that report only for Cassini ISS, requires its CISSCAL heading and one
unambiguous units line, and never exposes the line as a general PDS3 attribute.
An explicit non-I/F units field cannot be overridden by this report.
Voyager's IMAGE `REFLECTANCE_SCALING_FACTOR` remains a real attribute.
This preserves existing calibration evidence; it introduces no new colour claim.

## PDS4 numbers

`pds4Number` requires nonempty, finite decimal text, including scientific notation.
Empty fields, JavaScript hexadecimal/binary/octal notation, nested markup and
nonfinite results fail before a decoder uses them as offsets or coordinates.
The existing exact tag-prefix and unit-attribute policy remains unchanged; these
helpers are not a general XML parser or namespace resolver and do not expand entities.

## Checks

[Label tests](../packages/telescope/src/pds-labels.test.ts) exercise ambiguous scopes,
duplicates, quoted commas, multiline values, comments, malformed inputs and limits.
They read the original tracked Tethys and Proteus labels for source-backed cases.
[Calibration tests](../tools/objects/surface-observations/pds3-reflectance.test.mts)
preserve the native CISSCAL and Voyager evidence and reject contradictory units.
[PDS4 colour tests](../tools/objects/terrestrial-layers/observed-pds4.test.mts)
pass corrupted offsets and projection fields through the actual decoder while
retaining its existing exact RGB and missing-pixel expectations.

```bash
pnpm --filter @cssearth/telescope test
node --test tools/objects/surface-observations/pds3-reflectance.test.mts \
  tools/objects/terrestrial-layers/observed-pds4.test.mts
```

These checks need only tracked labels and synthetic image bytes, not downloaded
image banks or a browser. They do not qualify new observations or prove complete
PDS3/PDS4 format coverage.
