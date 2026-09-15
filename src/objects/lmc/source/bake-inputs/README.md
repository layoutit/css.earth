# Accepted LMC material inputs

These compact inputs reproduce the accepted application cloud without downloading the particle simulation archive, original observatory images, or star-removal models. They are intermediate scientific/display inputs, not runtime atlases or XYZ slice images.

- `density/`: the existing 266 × 259 × 116 simulated stellar-density field, its physical bounds, transfer recipe and original provenance. The KTX2 contains Zstd-compressed RGBA8 scalar channels, not rendered view directions.
- Three PNGs: the accepted 1024-pixel-wide, registered, starless RGB material planes. These are exactly the `source/registered-image.png` outputs of the reconstruction identities pinned by the existing lens receipts. Pixel direction is north-up, unflopped; never register them a second time.
- `inputs.json`: hashes of every retained input and the historical lens provenance/expected slice manifest. Appearance, projection and frame come from those unchanged receipts. Stars remain in the existing lens catalogue records.

The material planes total 2,602,302 bytes; the density field is 315,857 bytes. Full native images and NOX remain necessary only to revise extraction or registration in the research workflow.

Replay preserves the historical density Q90 and material Q92 encode/decode stages before the application Q80/A80 atlas pack. Every regenerated source slice is checked against its accepted digest. The three lenses share the same density; image colors do not create density or star positions. Saved density cutoff is zero for all three.

This is an exact replay of an accepted historical projection-only material method. It does not qualify that method as a measured 3D gas distribution or satisfy the newer finite-emitter material gate. Original source attribution, registration and processing receipts remain under the neighboring `lenses/` directories; their bytes are unchanged.
