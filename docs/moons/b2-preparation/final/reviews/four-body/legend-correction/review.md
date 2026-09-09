# Corrected scalar legend supplement

**The previously truncated scalar legend metadata is readable in the inspected replacements.** I manually inspected 22 existing PNGs at DPR 1 and 2: Moon topography and rock abundance (4), plus Phobos, Deimos and Dimorphos elevation, albedo and slope (6 each). No scalar label or description overlap was seen in these images.

- Phobos and Deimos show the full `0.1 SPC relative scale`, wrapped onto two lines.
- Dimorphos elevation shows `20 m · 75 m reference sphere`; albedo shows `1.30 unitless · SPC relative brightness`. Both wrap cleanly onto three lines with space before the description.
- Moon's km and percent legends and all three slope legends remain readable. Model, reference-radius and missing-coverage explanations fit below the legends.

The exact PNG paths, dimensions, byte counts and SHA-256 values are in `inspected-paths.json`; every hash matches its capture receipt. `review.json` pins the completed capture report and `site/maps-shell.css`. The full capture snapshot records `CAPTURED_UNREVIEWED` with browser close `COMPLETE`, rather than treating capture completion as visual approval. Its code HEAD is `57d5f12bea735bbf4ee6e1ec00ea14827e0e7923`; this supplement qualifies only the enumerated scalar cards.

Dimorphos's long albedo card is scrolled to fit its full description. Its breadcrumbs are above the visible panel crop; the legend and description are visible. The `shadows-unsupported` filenames come from this card-only harness and do not change the bodies' Shadows capabilities.

This supersedes the earlier scalar metadata ellipsis findings for these exact replacements. It preserves the original overall capture failure, earlier drag/file receipts, mesh-edge limitations and supported-region framing limits. No new browser, capture, source decoding, test or checkout edit was performed. The viewer reduced DPR2 PNGs for display; no pixel-level or native parity is asserted.

Capture directory, relative to `/Users/ekrof/fed/cssEarth-pluto-small-moons`: `output/playwright/b2-surfaces/legend-correction-2026-09-09T04-19-50.904Z/`.
