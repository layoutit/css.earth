# World-context refactor: evidence

Tested revisions: `main` at `8a64ff04cd` and the change at `9ad8327eaa` (refactor/world-context-lifecycle). Each revision's renderer was built with `pnpm build:renderer` and served by the same local `astro dev` server. Captures come from headless Chromium at 1280 × 800 (phone 375 × 812), 1x device scale, after `window.__cssEarth.ready` plus 1.5 s, and 2.5 s after each step. Each revision was captured twice to measure run-to-run noise.

`pixelmatch.txt` covers six views: Earth, Earth on the phone, Mars, the Solar System overview, the overview with the Planets pill, and the overview after a drag. Every pair (main/main, change/change, main/change) has 0 changed pixels at threshold 0.1 (anti-aliasing included) and at threshold 0.

`markers-*.json` records the state each of the 743 world-context markers published: body, label and indicator visibility, highlight, selection and mover visibility. These states are identical between main and the change in every view. The scenarios do change something: the Planets pill highlights 13 bodies, and the drag changes 16 markers and 7,800 pixels against the plain overview. The images here are the three overview views on both revisions.

`flight-mars.json` records a real flight from the overview to Mars on the change. The flight caption shows "Mars", the circle shows while the body is small, both hide, and the page arrives with no errors. The unit test "one retained flight caption survives the sprite fade through arrival" covers the same owner.
