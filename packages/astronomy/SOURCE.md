# Astronomy sources

The package owns time scales, float64 vectors, reference frames, ephemeris
series, rotation models, and accuracy records. LICENSE retains the MIT terms.

The upstream source, commit and hashes for mirrored files remain in upstream.json.
Locally maintained files are listed separately: package guides, public exports, body and rotation registries, dwarf/asteroid/satellite frame integration,
their numerical checks, and scientific record generators and outputs. The sync preserves these files; their
changes are reviewed through version control and numerical tests. It must not
overwrite them with the upstream single-file layout.

The generators still acquire scientific sources and emit the same numerical
records. Horizons fixtures are separated into planetary and moon/small-body
sections; satellite elements are separated by parent system. Their writer
enforces the 600-line limit before emitting source. Asteroid fixtures use bounded
record sections behind the same `ASTEROID_FIXTURES` export. Run
`node tools/generate-asteroids.mts --format-only` from this package to repartition
the retained records without downloading or changing their source values.

`node tools/ci/sync-upstream.mts` from the root refreshes mirrored astronomy files
and scientific catalogues. It does not replace the locally maintained catalog
package. Dirty upstream sources are rejected unless --allow-dirty is requested.

Consumers import the built @cssearth/astronomy workspace package. tsup produces
ESM, CommonJS, and declarations. Vitest tests the numerical implementation, and
the sync tests verify the mirrored file manifest.

`asteroidElements` and `asteroidPositionKm` expose Vesta's heliocentric ICRF
osculating ellipse from JPL Horizons solution JPL#36, at JD 2461286.5.
`tools/generate-asteroids.mts` records the exact element and vector queries.
Independent vector fixtures bound the fit below one meter at the epoch and
below 300 km at the two sampled dates thirty days either side. These checks
do not establish long-term perturbed-orbit accuracy. Horizons' TDB epoch is
approximated as TT, with a difference below two milliseconds.

The local `source/scene-epoch/` closure and `tools/scene-ephemeris.mts` /
`tools/acquire-scene-ephemeris.mts` belong to cssEarth's fixed-date preparation.
They are explicitly preserved by sync, not presented as copies from the mirrored
upstream commit. The local manifest hashes the raw NASA/JPL responses; preparation
and independent world-context tests verify their centers, time conventions and
actual published state. See that directory's README for the acquisition and
no-image regeneration commands.

## Hyperbolic Kepler support

The distant-world integration extends `src/kepler.ts` and its tests for unbound orbits. These files are maintained locally; `upstream.json` retains their last mirrored hashes without attributing the new code to that commit. The source-bound hyperbolic tests and existing elliptic tests cover this extension. The body data and id types are likewise local, with the public exports retained in `src/bodies.ts`.
