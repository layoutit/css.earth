# Observable Universe

The last level of the zoom ladder: everything whose light has had time to reach us. It is an overview, an entry of the one
object registry with its own page, `/observable-universe/`, drawn by the Sun's world context around the mounted scene. It
has no scene and no prepared files of its own.

## What it shows

- DESI's galaxies and quasars, out to 6.6 Gpc.
- At its edge, the cosmic microwave background: light from 372,000 years after the Big Bang, on a sphere 14 Gpc away.

Both layers are baked and published by the [Nearby Universe](../nearby-universe/README.md) package, whose README lists
their sources, processing, tests and known problems.

## Registry entry

[object.json](object.json) authors the overview under `properties.overview`: its name, card description and place on the
zoom ladder (4, after the Milky Way, the Local Group and the Nearby Universe). `pnpm prepare:catalog` writes it to
`site/prepared-overview-objects.json` with the world host, and `site/objects.mts` adds it to `OBJECTS`.
