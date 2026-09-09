# Provenance and documentation

Owner: **PROVENANCE DOCUMENTATION** (assigned by the project maintainer, 2026-09-09).

This owner maintains the documentation contract, checks that claims lead to
reviewable evidence, and resolves duplicate or stale documentation ownership.
Body contributors remain responsible for their scientific interpretation and
the evidence produced by their changes. This role does not grant publication
or merge authority, or certify every body's scientific accuracy.

## Proposal for review

The [contract](CONTRACT.md) is **proposed v1**, not an adopted repository gate.
It builds on the existing source manifests and
[compiled lineage contract](../object-provenance.md). It introduces pilot body entry
points and proposes one portable evidence-run format, without changing the renderer,
registry, source schema, or prepared provenance schema.

- [Audit and findings](audits/2026-09-09/AUDIT.md): GitHub main, local HEAD and
  the captured index, with exact snapshot boundaries.
- [Measured inventory](audits/2026-09-09/inventory.json): file counts, logical
  Git blob sizes, source metadata and documentation organization.
- [Contributor templates](TEMPLATES.md): body README, source sections and a
  proposed evidence receipt. These examples are not qualification evidence.

## How agents would use this

Read the repository contract, this contract, and the target body's `README.md`,
`SOURCE.md`, `NOTICE.md` and manifests. Follow the README to current evidence and
open limitations. Update the affected source explanation and evidence pointers
in the same change. Reuse existing source IDs, product IDs and check runners.
Add a shared-contract rule only when a demonstrated new capability requires it.

This PR corrects onboarding, commits the celestial skill and adds four body
entry-point pilots. Remaining adoption work is described in the contract. Historical evidence remains at its existing paths while it is
indexed. This proposal creates no publication job or recurring automation.
