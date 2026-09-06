# Astronomy sources

The package owns time scales, float64 vectors, reference frames, ephemeris
series, rotation models, and accuracy records. LICENSE retains the MIT terms.

The upstream source, commit and hashes for mirrored files remain in upstream.json.
Locally maintained files are listed separately: package guides and the generated
record section writers and their output. The sync preserves these files; their
changes are reviewed through version control and numerical tests. It must not
overwrite them with the upstream single-file layout.

The generators still acquire scientific sources and emit the same numerical
records. Horizons fixtures are separated into planetary and moon/small-body
sections; satellite elements are separated by parent system. Their writer
enforces the 600-line limit before emitting source.

`node tools/sync-upstream.mjs` from the root refreshes mirrored astronomy files
and scientific catalogues. It does not replace the locally maintained catalog
package. Dirty upstream sources are rejected unless --allow-dirty is requested.

Consumers import the built @cssearth/astronomy workspace package. tsup produces
ESM, CommonJS, and declarations. Vitest tests the numerical implementation, and
the sync tests verify the mirrored file manifest.
