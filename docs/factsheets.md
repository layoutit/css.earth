# Factsheet conventions

The September 8, 2026 pass covers the 71 bodies registered on main at
`1398bd9025940b6fb0d0188dfa518cdfacba782e`. Facts belong to each object's authored
content and are published as prepared text. They do not configure rendering,
geometry, physical simulation, or camera scale.

## Measurements and sources

- Use **mean radius** for planetary size, following [JPL's physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html).
  Mean and equatorial radii are different measurements. Irregular bodies retain
  explicit model/reference radii and three-axis dimensions where appropriate.
- **Solar semimajor axis** is the rounded J2000 orbital scale from
  [JPL Table 1](https://ssd.jpl.nasa.gov/planets/approx_pos.html), whose fitted
  elements cover 1800–2050. It is neither the current distance nor a time-averaged
  distance. A moon's system value belongs to its parent planet's solar orbit;
  the moon's own orbit is shown first.
- Planetary orbital and rotation periods are sidereal values from JPL. Rotation
  is a full turn relative to the stars, rather than a sunrise-to-sunrise day.
  Retrograde rotation is explicit. Moon rotation retains observational or
  model qualifiers, including synchronous, assumed synchronous, and chaotic.
- Planetary mass, density, and equatorial gravity use JPL's table and units.
  Giant-planet gravity is a reference-level value, not gravity on a solid surface.
  Values are rounded for display; source rows retain their original precision.
- [JPL's satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/) supplies moon
  mean radii and densities. This pass adds densities only where the listed
  relative uncertainty is at most 20%, preserving nonzero uncertainty in the
  displayed value. Sparse or assumed physical properties are not filled in.
- Asteroid geometric albedos come from the body's existing pinned Horizons
  record when available. A shape-model reference radius is not silently relabeled
  as a measured mean radius. Different measurements can coexist: Galatea's
  current JPL radius is 79 ± 12 km; its existing three-axis shape estimate remains
  separately labeled.
- Moon counts are dated checks of NASA's body pages, rather than timeless facts:
  Jupiter 115, Saturn 293, Uranus 29, and Neptune 16 in September 2026.
  [Jupiter](https://science.nasa.gov/jupiter/jupiter-moons/),
  [Saturn](https://science.nasa.gov/saturn/moons/),
  [Uranus](https://science.nasa.gov/uranus/moons/),
  [Neptune](https://science.nasa.gov/neptune/moons/).
- Wind speeds, temperatures, ring dimensions, and other contextual facts retain
  the measurement's scope and approximate/maximum qualifiers.

## Corrections requiring care

Mercury's axial tilt is about 0.034°, using the measured 2.031 arcminutes in
[NASA's planetary geodesy archive](https://pgda.gsfc.nasa.gov/products/105).
Venus's 177.3° follows the spin-axis convention that includes retrograde rotation,
as in the [NASA Venus fact sheet](https://solarsystem.nasa.gov/internal_resources/1028/).
Pluto's approximately 120° uses the same convention. Its NSSDCA source was
available as a search-indexed 2024 fact sheet during this pass; the original
endpoint redirected to a maintenance page. Its review snapshot records that
limitation, and the display deliberately rounds the value.

The Sun's approximately 11-year activity cycle and approximately 22-year complete
magnetic cycle are separate facts. Its rotation entry specifies the equator
because the Sun rotates differentially.
[NASA solar science](https://science.nasa.gov/heliophysics/focus-areas/solar-science/).

## Editing and reproduction

1. Edit `panel.facts`/`panel.moreFacts` in the content source referenced by the
   object's `object.json`. Use stable semantic IDs, units, and meaningful precision.
2. Retain new reference values and definitions beside the object in
   `source/editorial/factsheet-review.json`, or cite an existing pinned source.
   Add its byte count and SHA-256 to the source manifest. `fact.source` records the
   URL, label, checked date, and local evidence path; it is provenance metadata.
3. Update the authored content SHA-256 in the descriptor and its manifest entry.
4. Run `pnpm prepare:factsheets -- <object-id>` to publish facts and refresh the
   content reference in existing preparation receipts. Omit the ID for all bodies.
   Run `pnpm prepare:factsheets -- --check` to verify without writing.

The facts-only preparer preserves the rest of the prepared content and scene
state. It rejects changed source pins, missing evidence pins, duplicate semantic
IDs, and an introduction mismatch. For introduction and lens prose/label changes,
`pnpm prepare:factsheets -- --editorial <object-id>` republishes that metadata
through the shared label formatter while preserving imagery, legends, charts,
settings and numeric scene data. Changes to those other assets or to the lens
inventory still require their full preparation owners. Add `--check` to verify
the editorial metadata without writing.
The shared ordering keeps four initial rows and the existing View more/View less
disclosure; measurements are never derived at runtime.

Focused checks:

```sh
node --test tools/prepare-factsheets.test.mjs site/test/fact-order.test.mjs \
  site/test/prepared-factsheet-model.test.mjs site/test/planet-shell.test.mjs \
  site/test/object-package-contract.test.mjs site/test/scene-sources.test.mjs
```

Browser checks should cover planets, moons, an irregular asteroid, the Sun, and
a dwarf planet at DPR 1 and DPR 2, including narrow viewports and long values.
Check row containment, readable labels, four-row previews, and both disclosure
directions. Full renderer and asset qualification remain separate checks.
