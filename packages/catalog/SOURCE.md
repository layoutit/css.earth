# Catalog sources

This package is maintained locally and supplies the TypeScript reader and writer
for the packed-column `.gxct` format described in FORMAT.md. Its MIT license is
retained in LICENSE. It is no longer overwritten by the upstream sync command.

Catalogue data an object ships keeps its own terms and provenance in that object's
source records and does not inherit this package's MIT license. `node --test` checks the local reader/writer; the optional Python parity
check requires the external catalogue pipeline.
