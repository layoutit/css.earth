---
name: Archive product the pipeline cannot read
about: Describe missing shared archive support for a requested handoff
title: "archive: <mission> <instrument> <product type>"
---

**Product:** a link to one real product and its label.

**Body and lens:** the body and the view that needs it.

**What fails:** the route you tried and the error, or the capability that is missing.

**What the archive offers:** per-pixel geometry, SPICE kernels, catalog cameras, calibration level, and any published photometric model you found.

**Which stage is missing:** identify decoding, source interpretation, map sampling, camera/body-frame reconstruction or surface correspondence as applicable. A controlled map need not reconstruct its original cameras. Use the [photographic investigation routes](../../.agents/skills/celestial-skill/references/photographic-investigation.md) and, for individual observations, the [surface-observation contract](../../tools/objects/surface-observations/README.md#adding-an-archive-product).

Use this template when a handoff is requested. Authorized shared-tooling work may
start with one consuming body; opening an issue does not replace that implementation.
