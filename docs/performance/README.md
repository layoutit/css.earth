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
| [Billboard-first startup](startup-billboard.md) | A default page's arrival image in place of the scene DOM at startup |
| [Marker declutter](marker-declutter.md) | Markers under others not drawn, a fixed marker order, a system past its scope drawn as its star, and a system card that lays out only the rows in view |
| [Startup gate](startup-gate.md) | Background banks held until a body's first view is interactive |
