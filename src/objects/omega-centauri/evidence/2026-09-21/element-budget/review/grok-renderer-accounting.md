**Verdict: not admitted for Omega.** This round certifies a synthetic one-topology CSS bank at **499** nodes with a **1-element reserve**, not the live object and not compiler authoring.

The 500 cap is a DOM quota, not visual acceptance. Renderer physics is unchanged (receipt). Historical replay is not given a certificate in these files.

---

### What the numbers actually are

Profile `css-volume-single-topology@1`: `maximumElements=500`, `elementsPerSlab=3`, `elementsPerStar=1`, `reservedElements=47` (`compiler-render-budget.ts` 5–8).

Count: `47 + stars + 3×slabs` (`render-element-budget.ts` 29–32, 42–46). Stars are subtracted **before** slabs (`maximumRenderSlabs` 36–40).

Measured mount (FakeElement, object root only):

| slabs | stars | copies | overhead | total |
|---|---|---|---|---|
| 151 | 0 | 453 | 46 | **499** |
| 150 | 3 | 450 | 46 | **499** |

That matches the test (`prepared-volume-lenses.test.ts` 106–113). Predicted total is **500**; mount is **499**. Shell/`before` are outside `descendants(root)`.

26 impostors, XYZ×3 copies, hidden nodes, empty star wrapper are in that 499 (108–110, 127). `volumeResidentDomNodes` matches (`prepared-volume-lenses.ts` 202–208).

No growth on that payload: same node identities across `selectLens` / `publish` / star toggle, `volumeResidentTopologyCount === '1'` (115–125). All three lenses share topology in `budgetPayload` (87–97), so `ensureFamily` does not allocate a second cloud (210–213, 293–304).

Lab uses `mountPreparedCssVolume` only (`volume-renderer.ts` 38–39): no LOD, no 26 impostors, no lens bank. Inclusive cost is **smaller** than 46, so the **same** slab/star counts still sit under 500. A looser lab-only slab count is not shown.

---

### P0

None in this packet for the **declared** profile (one topology, ≤26 impostors, no front root).

---

### P1

1. **Authoring is not in the change.** Requirement: default compiler reserves **actual stars**, then slabs. Only the contract + a hand-built test payload call `createRenderElementBudget` (`prepared-volume-lenses.test.ts` 105, 112). Production bake/viewer (`compiler-viewer.ts` 26–50, 78–96) does not. Quota cannot stop Omega from shipping a fatter bank yet.

2. **499 is not Omega admission.** Packet already assigns that to a real browser count. FakeElement + `querySelectorAll = []` never exercises adoption, extra anonymous nodes, or a second object.

3. **This profile does not cover the product if Omega is not that topology.** A second topology is still retained hidden at 52 nodes (`prepared-volume-lenses.test.ts` 198–215; `ensureFamily` 210–225). Occulting `frontRoot` is extra (`prepared-volume-lenses.ts` 175–182, 208) and **uncertified**. Treating 499 as “Omega stays ≤500” would be false if either path is live.

---

### Borderline P2

**Overhead slack is real, not measured-tight.** Reserved 47 vs inclusive 46, assert `length === 499` and `<= 500`. One extra wrapper still fits 151/150 slabs. Mutation only failed **per-slab copies** (`604` vs `453`, `600` vs `450`) — not a +1 wrapper. Intentional reserve, but it is not a lock on overhead.

---

### Ordinary P2 (non-blocking)

- Multi-topology test documents growth; it does not fail a 500 cap.
- `readRenderElementBudget` can reserve more stars than mounted (`render-element-budget.ts` 48–51); honest for union banks, unused by these tests.
- Lab has no profile of its own; it only “fits” because it is cheaper.

---

### Uncertainty

- Live Omega topology count, occulting front host, and whether historical bakes get a `cssearth-render-element-budget@1` field.
- Whether round 2 wires `maximumRenderSlabs` on the real compiler. Until then, replay of old bytes is honest **only if** nothing writes a new budget onto them (not shown).

---

### Required verification (admission, not this unit file)

1. Real Omega: inclusive **element** count of that object’s root+descendants (copies, stars, wrappers, hidden, impostors; no shell). Must be ≤500 after camera, lens/material, and star visibility changes, with **no node growth**.
2. Default compiler: `starCount` reserved, **then** `slabCount ≤ maximumRenderSlabs`; reject `< 3` complete XYZ.
3. Historical immutable bytes: load without minting this profile/budget.
4. Lab mount of the same bake: inclusive count ≤500 (expected easier).

Mutation already shows extra per-slab DOM fails copies; keep a check that **total** `descendants` exceeds 500 if overhead or copies grow.

=== REPORT COMPLETE ===
