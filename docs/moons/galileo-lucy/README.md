# Dactyl, Dinkinesh and Selam

Three additional destinations use the existing object adapter, shared camera and retained PolyCSS renderer. Dactyl belongs to Ida; Selam belongs to Dinkinesh. Each is independently selectable, with one detailed object scene mounted at a time.

| Body | Displayed shape | Canonical triangles | Selector |
| --- | --- | ---: | --- |
| Dactyl | Smooth 1.6 × 1.4 × 1.2 km envelope from Galileo measurements | 512 | Shape · Galileo |
| Dinkinesh | Attributed Celestia reconstruction, scaled uniformly to the published 738 m volume-equivalent diameter | 1,200 | Shape · Model |
| Selam | Two touching ellipsoids at Lucy’s published lobe dimensions | 1,024 | Shape · Lucy |

The gray grid identifies missing qualified surface imagery. Dactyl’s craters, Selam’s neck and the unseen terrain are not reconstructed from photographs. Dinkinesh’s contributed model is an authored approximation, not the mission photogrammetric model. Shadows uses the shared lighting capability and the documented display orientations.

[Dactyl sources and limits](../../../src/planets/dactyl/README.md) · [Dinkinesh sources and limits](../../../src/planets/dinkinesh/README.md) · [Selam sources and limits](../../../src/planets/selam/README.md) · [Reproduction](../../../tools/objects/source-authoring/galileo-lucy/README.md)

## Approximate orbits

Dactyl and Selam have illustrative phases at the shared 3 September 2026 TT scene epoch. Their source records separate published dimensions, separation and period from assumed plane, periapsis and phase. Dashed paths, circular selected indicators and visible “Approx.” labels carry that distinction into the universe view. These marks do not describe an uncertainty region or confidence interval.

The dashed strokes alternate paint on existing retained orbit segments. Geometry, picking corridors, node counts and the shared camera remain unchanged. The browser check verifies the actual transparent gaps and circular indicators after projection.

![Dactyl’s approximate orbit around Ida](images/dactyl-approximate-orbit.png)

![Selam’s approximate orbit around Dinkinesh](images/selam-approximate-orbit.png)

## Inspected views

Chrome 152.0.7977.84, desktop captures at DPR 1. Full browser conformance also covers mobile input and DPR 2. Capture source corresponds to commit `514f6b4975919027cdee0b02ecff5da43c19085f`; subsequent changes to the independent context test and review records do not alter the rendered views.

![Dactyl’s Galileo shape estimate](images/dactyl-shadows-false.png)

![Dinkinesh’s attributed reconstruction](images/dinkinesh-shadows-false.png)

![Selam’s measured two-lobe envelope](images/selam-shadows-false.png)

Directional lighting was also inspected for [Dactyl](images/dactyl-shadows-true.png), [Dinkinesh](images/dinkinesh-shadows-true.png) and [Selam](images/selam-shadows-true.png).

## Evidence

- [Dactyl conformance](evidence/dactyl-conformance.json), [Dinkinesh conformance](evidence/dinkinesh-conformance.json), [Selam conformance](evidence/selam-conformance.json): desktop/mobile input, surface picking, wheel and pinch zoom, shadows, lifecycle, retained identity and DPR 1/2. All cases passed.
- [Visual and navigation receipt](evidence/visual-navigation.json): both lighting states, dashed paths, circular selected indicators and successful Dactyl → Ida / Selam → Dinkinesh navigation with one mounted scene.
- [Navigation pixels](evidence/navigation.json): existing decoded visible marker pixels preserved exactly at both densities against the current-main atlas; only the three new recipes are rendered.
- [Delivery receipt](evidence/delivery.json): 93 published assets, 21,219,882 bytes. A fresh download of every file passed byte-count and SHA-256 verification.
- [Dinkinesh orbit comparison](evidence/orbit-errors.json): independent Horizons vectors agree at the fitted epoch within 0.001 km. The measured ±30-day endpoint errors are about 991.49 and 902.83 km; the display conic is not a long-term ephemeris.

Source measurements, native CMOD, conversion receipt, generated OBJ, orbit parameters, original Horizons responses and reuse terms are retained in the body packages. The numerical and closure checks validate those inputs separately from the browser presentation. These screenshots do not establish photographic registration or native mission-model parity.
