# Point-field fixture

The 255 rows sample the stellar neighbourhood bank: every 684th prepared row,
all 96 coverage anchors and Sirius. Source-row ids are remapped to a dense local
range; positions, decoded magnitudes, colours and names retain their source values.
The hierarchy and 16,384-byte bank were prepared with the bake encoder and an
eight-row leaf limit. `stars.bin` is that bank packed as the site publishes it
(`@cssearth/objects` prepared-binary.ts); the manifest pins the unpacked bytes. The manifest counts agree with the bank. The fixture follows the current prepared-object schema (no direct-point pool) and was regenerated from the inventory-listed stellar neighbourhood data.

The atlas recipe retains the authored pixel parameters used by the quantization
check. Image resource metadata is retained for loader validation; these tests
mock image transport and need no atlas image. This fixture tests hierarchy
selection, binary validation and runtime loading without the full catalogue.
It does not qualify full-catalogue performance or source coverage.

The sampled rows hold magnitudes that were already decoded from the full bank, so
re-encoding them loses nothing and the magnitude quantization error measures 0;
the full bank measures about 0.0005. The check therefore asserts the bound
(`measured <= bound`), not a positive error.
