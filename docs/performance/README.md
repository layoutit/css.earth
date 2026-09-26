# Performance notes

Measured runtime work on the shared renderer and navigation, each tied to the
revision it tested. Local captures under `output/` are not tracked; the notes
name the recorder and trace identifiers instead.

| Note | What it measured |
| --- | --- |
| [CSS graphics techniques](cssgraphics-tech.md) | Retained-DOM drawing techniques compared for cost and fidelity |
| [Opacity publication](opacity-publication.md) | Publishing prepared opacity without per-frame style writes |
| [Opacity dirty publication](opacity-dirty-publication.md) | Writing only changed opacity values |
| [Point-frame publication](point-frame-publication.md) | Point-field frames during flights and galaxy round trips |
| [Prepared orbit strokes](prepared-orbit-strokes.md) | Orbit stroke batches and their level-of-detail chords |
| [Retained layout boundaries](retained-layout-boundaries.md) | Style containment that keeps invalidation local |
| [Coasting freezes membership](motion-freezes-membership.md) | The inertia gate: what may change while the camera coasts |
| [World-context delta publication](world-context-delta-publication.md) | Publishing only changed world-context bodies |
