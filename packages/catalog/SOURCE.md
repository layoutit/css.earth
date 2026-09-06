# Catalog sources

This package is maintained locally and supplies the TypeScript reader and writer
for the packed-column `.gxct` format described in FORMAT.md. Its MIT license is
retained in LICENSE. It is no longer overwritten by the upstream sync command.

Scientific catalogue data has separate terms and provenance in data/catalogs.
Those records are preserved by the data sync and do not inherit this package's
MIT license. Vitest checks the local reader/writer; the optional Python parity
check requires the external catalogue pipeline.
