# Lagoon faint-signal and footprint trial

The active compiler recipe and saved cloud remain the previous inspected baseline. `faint-trial.json` contains the separate experimental recipe; it is not a promoted reconstruction.

Two preparation defects were isolated on the current sources:

- The default background estimate discarded about 61% of the ESO optical footprint before fitting. Lowering its spread multiplier from 1.5 to 0.75 recovers visible faint outskirts.
- VISTA's isolated footprint retained a 30% contribution even when its source weight was reduced: the weighted mean divided that weight out. The trial supplies an explicit denominator floor, reduces VISTA's weight from 0.15 to 0.04 and tapers its contribution over 180 arcseconds at its data boundary. Source pixels, no-data flags and cloud bounds remain intact.

In the fixed diagnostic regions and identical display transform, the second trial reduces the VISTA lower-wing modeled signal by 99.7% and raises the optical western-outskirts signal by 39%. These are selected-region comparison measurements, not whole-nebula accuracy. The target changes between trials, so their fit RMSE values cannot be treated as matched scientific accuracy scores. The fit has 479 supports.

Spitzer's central detail remains unresolved: 1.22 arcseconds per native pixel becomes 10.08 arcseconds in the evidence and 15.12 arcseconds in the target. The minimum fitted structures are approximately 23 arcseconds wide. More brightness cannot recover the discarded spatial information. Finite-component material previews retain broad colors but lose thin filaments and produce colored beads. A full bake was therefore withheld.

The next spatial-model task needs local fine-scale evidence and connected finite emitters for the central region, with separate per-band colors. Do not recover Spitzer detail by repeating a photograph through depth. Hubble's small optical field also needs a qualified registration bridge before a local composite can use it; see the source dossier for the failed registration attempts.

Local evidence: `output/m8-faint-diagnosis/` contains source/target/projection comparisons, original JSON metrics, prepared finite-color front/60-degree previews and `comparison.html`. The bounded two-trial comparison is complete; it did not qualify a new cloud or replace the running model.
