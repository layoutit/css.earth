# Spacecraft and individual mission catalogues: decision

**Status:** Implemented. The maintained architecture and authoring rules are in
[Missions, spacecraft and dataset attribution](exploration-catalog.md).

The [accepted proposal, including the review revisions](https://github.com/layoutit/cssEarth/blob/5d64c923f7d2cd3bb4342dd9cd226b605e00327c/docs/architecture/spacecraft-missions-proposal.md)
is preserved at its implementation-source commit. It examined the earlier
`16774548b140b45e1f8cf50e21b9671055e0823f` baseline. Its acceptance table describes
the intended checks, not test results.

## Accepted architecture

Use `MISSIONS` for individual missions and `SPACECRAFT` for physical science
vehicles. Both connect to prepared dataset provenance. Participation alone does
not establish observation credit. The initial migration replaces the 24 mixed
records with 26 missions and 36 vehicles, including separate Viking missions,
GRAIL's two vehicles, and the shared OSIRIS-REx/APEX spacecraft.

Keep one `OBJECTS` scene registry, one generic adapter, one shared shell and one
world camera. Catalogue records do not require scenes. Global mission browsing,
spacecraft rendering and live trajectories remain outside this change.

## Revisions resolved before implementation

The review identified two gaps in dataset navigation:

1. **A production selection capability.** The generic scene lifecycle now exposes
   committed dataset IDs, cancellable selection and subscriptions. The existing
   selection transaction rejects aborted or superseded work before publication;
   the router does not depend on inspection APIs or synthetic control clicks.
2. **A complete URL lifecycle.** The existing router applies dataset fragments on
   direct load, same-body and cross-body navigation, and Back/Forward. Manual
   selection updates the current URL. Failure preserves a coherent committed
   selection, and same-body dataset links preserve the camera.

The [maintained guide](exploration-catalog.md#preparing-and-checking-a-change)
links the executable checks. Browser evidence must identify the tested code and
prepared files, and distinguish catalogue behavior from body-source or delivery
qualification. A remaining unrelated qualification failure keeps the PR in draft.
