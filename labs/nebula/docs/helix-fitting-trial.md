# Helix: fitting with the actual controls

2026-09-12. Tested the live detector and shape workbench in an isolated browser against the existing registered, star-separated ESO wider-field source. Source originals, shared catalogue and the operator's browser settings were preserved. This is a failed visual fit, not a new accepted model.

## What the UI trial showed

| UI operation | Observed result |
| --- | --- |
| Baseline detection: 100% sensitivity, 7% minimum radius, limit 12 | Nine boundaries initialize six mostly central shells. The bright annulus has some support; the faint outer envelope and irregular arcs are largely absent. |
| All components → Ring | Opens the centers, but produces overlapping complete rings with uniform azimuthal emission. It does not recover the uneven observed rim. |
| Solo S1 → Ring; Thickness 0.41 | Gives a readable central hole and a broad annulus. It still misses the asymmetric bright sectors, cavity emission and extended outer signal. |
| Sensitivity 400%; limit 32; minimum radius unchanged | Adds large, spurious full shells around broad background contours. The edges view makes the mismatch obvious. More detected curves is not a better fit. |
| Rotate the high-sensitivity cloud | Reveals complete smooth ellipsoids inferred from partial image evidence. Rotating the photograph alongside them is useful for orientation, but supplies no new observed depth. |

The high-sensitivity result's whole-frame normalized luminance RMSE was about 0.500, with 24.6% missing signal and 20.5% excess. The isolated central-ring trial was about 0.861 RMSE, with 85.7% missing and 1.5% excess. These scores include the entire uncalibrated image, residual stars and background. The numerically lower score rewarded broad false emission: **it is not a nebular-shape quality score**. They must not be used to select the high-sensitivity result as an improvement.

Local screenshots and isolated browser-state snapshots are in `.local/nebula-lab/helix-fit-session/`. The registered wider-field source identity is `9736dd85dd142f7b3be7c320235518211e2614380c76e793e24a62706f9584d2`, its actual working raster SHA-256 is `51aae00efb42da3f66ac50c1d76c076e2c2825ed69434f89776984e747150c94`; the unchanged structure map is `1814217705a9360feb347a6fd9df6ec8b13a56e7275f4f059382af1b384aab0e`. These observations apply to the ellipse detector and shell/ring/ellipsoid field at this checkpoint, not later compiler methods.

## The actual limitations

- Detection fits connected isophotes to ellipses. It scores boundary support, not whether the projected cloud reproduces the image. Incomplete arcs must currently cover a substantial fraction of a full ellipse to survive.
- Initialization merges similar contours and gives each component uniform weight, thickness and softness. It does not fit those quantities to the observed emission.
- Supported arc intervals are retained in the evidence but do not shape the 3D emission. A partly observed boundary becomes an entire glowing shell or ring.
- The current shape model has image-plane rotation and a depth stretch. It lacks independent 3D inclination, variable azimuthal emission and flexible radial wall profiles. Existing subtraction can remove emission but cannot supply those missing freedoms.
- Fine adjustment is also awkward: source-pixel position/size sliders span much more than the bright ring. The live loop removes the click/accept bottleneck, but it cannot compensate for an unsuitable representation.

## Recommended next experiment

1. Fit the main annulus and its faint cavity together against star-suppressed, multiscale luminance and edges. Solve the center, axes and radial emission profile; do not use texture to conceal the residual.
2. Preserve supported arc sectors and fit smooth azimuthal variation. Compare a partial curved band with a complete shell instead of always completing the ellipse.
3. Fit the remaining outer signal separately, using the residual after the central fit. Penalize excess emission and unnecessary components; distinguish nebular support from stars/background before optimizing the whole frame.
4. Only then compare alternative inclined 3D lifts of that projected model. Keep depth/inclination as explicit hypotheses constrained by independent observations, not measurements recovered from one RGB image.

Keep the same live controls and prepared Structure/Compare/Overlay views. The next bounded acceptance gate is one central annulus plus one outer arc that fits better in both luminance and edges without filling unsupported sectors. Preserve competing depth hypotheses; do not add every possible primitive before this gate works.
