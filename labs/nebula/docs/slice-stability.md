# Density shape and slice stability

Images are materials on one fixed density volume. They do not determine geometric support, slice bounds, stellar positions or the cutoff field. A bright image pixel over empty density emits nothing. Missing image coverage stays uncolored; it does not remove stars from the independent catalogue.

The current LMC comparison uses the full simulated stellar density, not a measurement of nebular gas. The original prepared 943-star catalogue retains its exact XYZ and photometry in every image variant. Its inferred depths remain hypotheses. Image/color changes cannot select or reposition stars.

## Bake calibration

Use the same physical volume bounds, XYZ slice positions, density scale and exposure for each material. Counts now follow physical extent: 128 slices on the longest axis produces 128/125/56 for LMC, with approximately0.488/0.487/0.487kpc spacing. Disable image-dependent slice cropping. Do not fit a separate thickness or normalize each photographic column. Image RGB modulates existing density only.

RGBA8 rounding used to erase faint optical contributions independently in every slab. With 96 thinner Z slabs versus 48 X/Y slabs, Z lost more light. A gain adjustment could brighten surviving centers but would not recover erased outskirts.

The baker now carries the small optical RGB rounding residual along each raster ray into the next occupied slab. It encodes the corrected contribution, decodes what was actually stored and retains only the difference. True-zero slabs stay transparent. Three color residuals avoid bias when faint adjacent layers have different colors. This is quantization error feedback, not a density or image-column normalization.

## Recorded comparison

For each axis, recover optical RGB from the lossless masters and integrate it with physical pixel area. A volume's total emissivity should agree across axes even though its projected shape and local brightness differ.

| Image | XYZ optical-energy spread before | After | Largest remaining RGB-fraction spread |
|---|---:|---:|---:|
| Horálek | 5.21% | 0.092% | 0.0042 percentage points |
| ESO VISTA | 8.08% | 0.256% | 0.0058 percentage points |
| NASA WISE | 22.76% | 1.928% | 0.628 percentage points |

These measurements are from the same physical density and approved native NOX images. No per-axis or per-image gains were fitted. WISE is the faintest treatment and retains a small quantization/color bias; these values do not prove perfectly identical rendered colors at every view.

## Actual browser outcome: improved, not accepted

The original48/48/96 banks had physical pitches of1.30/1.27/0.284kpc. At one identical camera pose, isolating the active Y/Z banks exposed23.5%/25.7%/38.4% luminance differences for Horálek/VISTA/WISE. Physical pitch correction removed most of that imbalance. Doubling the final slice resolution did not improve Horálek's remaining image residual, so the default remains128 longest-axis slices.

The final browser check uses native brightness, no cutoff and no stars. Both banks keep their existing optical-path compensation and exactly the same camera. It captures each bank separately at a two-bank handoff. Thresholds remain5% relative luminance difference and0.04 normalized pixel L1; the latter is sum(abs(A−B))/sum(A+B) over RGB.

| Image | Y/Z luminance difference | X/Z luminance difference | Y/Z image L1 | X/Z image L1 |
|---|---:|---:|---:|---:|
| Horálek |0.20%|6.20%|0.0513|0.0489|
| ESO VISTA |0.88%|5.92%|0.0517|0.0538|
| NASA WISE |2.06%|5.77%|0.1062|0.1094|

**The strict visual gate fails for all three candidates.** This is a usable lab checkpoint, not accepted rotation stability. The biggest remaining integrated color difference is0.99 percentage points in WISE's X/Z comparison. WISE also has the strongest local texture discrepancy. No per-axis gain has been fitted to conceal these failures.

The bounded sampling comparison has reached an impasse: additional slices did not close the residual. The next investigation belongs to low-opacity slice encoding/interpolation and compositing. A replacement must improve the same-camera evidence while preserving density support and colors; merely matching bank averages is insufficient.

All three outputs contain identical309-quad geometry and the same943-star catalogue. Each resource hash was verified. Seven camera poses per image and source switching completed without browser errors or processing requests. The lab's147 tests and TypeScript check pass; those results do not override the failed visual gate.

Run the maintained saved-output command through `src/run.ts browser-reconstruction-stability`, after installing dependencies and starting the lab as documented in its README. It reads `.local/nebula-lab/density-reconstruction-acceptance.json` by default, writes screenshots and a report under `.local/nebula-lab/reconstruction-stability/`, and exits nonzero when the gate fails. It never processes images.

## Repeatable review

1. Verify identical geometry, unchanged source-density bytes and identical star catalogues across the variants.
2. Check XYZ quadrature before baking. Raise integration sampling without changing the convergence threshold.
3. Compare decoded master optical-energy totals and channel proportions. Also inspect compressed delivery; lossless alpha does not imply lossless RGB.
4. Inspect front, ±60° around both axes and both edge views, with a fixed camera/framing/exposure and stars temporarily hidden.
5. At the same pose inside a two-bank transition, isolate each active bank with its existing optical-path compensation. Compare whole rendered images; changing pose is not a valid isolation of bank error.
6. Orbit and zoom with stars restored. Preserve controls and camera on source changes; selecting an already prepared source must not process again.

A longer line of sight can gradually brighten a region; different colored regions can overlap from another direction. Those effects differ from an abrupt slice-bank seam. Do not equalize every view's histogram or dynamically pump exposure to make all projections identical. A new physically constrained nebula model is separate from this rendering calibration.

The initial density-field conversion fixes the extruded photographic rectangle. It does not solve every limitation of painting one observed image through uncertain depth, including diffuse side views and unobserved coverage.
