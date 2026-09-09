# B1 parent browser checks — preintegration evidence

Haumea and Sylvia each passed DPR 1 and DPR 2 in real Chrome 152.0.7977.76 against the diagnostic server at `http://127.0.0.1:4211`. These four cases were run before integration of newer main `c61d1bf9`; final merged-head browser qualification is still required.

The existing conformance runner verified canonical density-2 asset selection on both device densities and its interaction, interruption, release-position and retained-scene checks. Commands, durations, exact descriptor/report/video hashes and result details are in [qualification-parents.json](qualification-parents.json). No browser remains active from this run.

The Haumea close view retains its elongated figure and ring, with the NASA surface labeled illustrative. Sylvia's wide and close views retain its irregular published figure and missing-imagery grid. No visible blocker was found in those bounded visual checks; no native/source-renderer pixel parity is claimed.

- Haumea: `output/playwright/moons-b1-qualification/visual/haumea-dpr-2-t18.png`
- Sylvia: `output/playwright/moons-b1-qualification/visual/sylvia-dpr-2-t4.png` and `sylvia-dpr-2-t18.png`

The six-moon visual review is tracked separately in [qualification-visual.json](qualification-visual.json). Paaliaq was reviewed; Bestla, Sycorax, Squannit, Hiʻiaka and Romulus remain pending successful final-head captures.
