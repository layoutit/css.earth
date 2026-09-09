# Evidence

The [provenance contract](../provenance/CONTRACT.md) owns evidence identity,
portability, storage and claim scope. New runs use
`docs/evidence/runs/<UTC>-<scope>-<short-id>/` with `index.json` and `REVIEW.md`.
The [templates](../provenance/TEMPLATES.md) define the proposed envelope.
Existing producer reports remain unchanged and are referenced by the envelope.

Historical evidence currently lives here and in `docs/moons/`, `docs/comets/`,
Earth subject directories and tracked asteroid archives. Those paths remain
valid. This documentation change does not move, discard, regenerate or promote
any historical capture. Introduce a portable wrapper only from actual receipts;
use `UNBOUND` when exact candidate identity cannot be recovered.

Start from the body's README for the applicable run and unresolved claims.
Shared batch evidence is stored once and referenced by each participating body.
Current entry-point pilots cover [Earth](../../src/planets/earth/README.md),
[Sun](../../src/planets/sun/README.md), [Rhea](../../src/planets/rhea/README.md)
and [67P](../../src/planets/comet-67p/README.md).

The evidence envelope is not yet consumed by a new executable validator. Use
the existing source, provenance, runtime closure and browser checks; do not
interpret template conformance as qualification. Durable external storage and
bulk migration remain explicit follow-up work in the contract.
