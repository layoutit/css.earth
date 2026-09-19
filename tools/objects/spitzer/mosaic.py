"""Re-make one Spitzer/IRAC level-2 mosaic from the level-1 frames the archive mosaicked.

Driven by tools/objects/spitzer/mosaic.mts, which validates the pins first and passes one JSON job on argv[1]. Nothing here
reaches the network, reads a configuration file or opens a window.

This is not the observatory's software. Spitzer's own mosaicker is MOPEX, and the toolkit records, as a measurement, that its
macOS build would not run on this machine. What runs instead:

  1. each frame is read with its own WCS, including the SIP distortion polynomial the archive fitted to it;
  2. pixels the frame's imask flags, and pixels that are not finite, are dropped;
  3. the frame is resampled onto the output grid with reproject's exact spherical-polygon overlap, which preserves surface
     brightness (the frames and the mosaic are both in MJy/sr, so no area rescaling is wanted);
  4. output pixels an individual frame covers only partly are dropped from that frame's contribution, because an exact overlap
     divided by a sliver of area is noise, not signal;
  5. the frames are put on one background level: each frame is offset to the stack's median where it overlaps the rest, a few
     passes, with the offsets held to zero mean so the mosaic's own level is not moved. IRAC frames of one map do not share a
     background, and in channel 3 of the proving observation the frames' own levels ran from 0.30 to 0.97 MJy/sr, as large as
     the signal. The observatory's pipeline calls this the overlap correction;
  6. the surviving frames are averaged with equal weight per contributing frame.

Three choices are measurements, not preferences, and the guide records the numbers:
  - equal weights beat inverse-variance weights against the archive's own product;
  - a sigma clip across the stack makes agreement worse, not better, at this depth, so none is applied;
  - background matching leaves channels 1 and 4 unchanged and lifts channel 3 from 71% to 98% of pixels inside the archive's
    own stated uncertainty, at the cost of a 0.7% shift in that channel's overall level. Both numbers are in the guide.

The output grid is the archive's own, read from the reference mosaic. That is what makes a sample-by-sample comparison
possible, and it is a limit: this run does not choose the geometry. So that the choice is still checked, the grid the frames
themselves imply is derived independently with reproject's optimal-WCS search and reported beside the archive's.
"""
from __future__ import annotations

import json
import sys

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from reproject import reproject_exact
from reproject.mosaicking import find_optimal_celestial_wcs


def _finite(name: str, value: float) -> float:
    if not np.isfinite(value):
        raise ValueError(f"{name} is not finite")
    return float(value)


def main(job_path: str) -> None:
    with open(job_path, "r", encoding="utf-8") as handle:
        job = json.load(handle)

    reference = fits.open(job["reference"])[0]
    header = reference.header
    wcs_out = WCS(header)
    shape_out = (int(header["NAXIS2"]), int(header["NAXIS1"]))
    threshold = _finite("footprintThreshold", job["footprintThreshold"])
    if not 0.0 < threshold <= 1.0:
        raise ValueError("footprintThreshold must be in (0, 1]")

    predicted = len(job["frames"]) * shape_out[0] * shape_out[1] * 4
    if predicted > int(job["maxStackBytes"]):
        raise ValueError(f"the reprojected stack would need {predicted} bytes, over the budget of {job['maxStackBytes']}")

    stack = np.empty((len(job["frames"]), *shape_out), dtype=np.float32)
    frame_wcs = []
    frame_shapes = []
    for index, frame in enumerate(job["frames"]):
        with fits.open(frame["image"]) as opened:
            image = opened[0].data.astype(np.float64)
            frame_header = opened[0].header
        with fits.open(frame["mask"]) as opened:
            mask = opened[0].data.astype(np.int32)
        if mask.shape != image.shape:
            raise ValueError(f"{frame['image']}: its mask is {mask.shape}, the image is {image.shape}")
        rejected = (mask != 0) | ~np.isfinite(image)
        image = np.where(rejected, np.nan, image)
        wcs_in = WCS(frame_header)
        frame_wcs.append(wcs_in)
        frame_shapes.append(image.shape)
        resampled, footprint = reproject_exact((image, wcs_in), wcs_out, shape_out=shape_out)
        stack[index] = np.where(footprint >= threshold, resampled, np.nan)

    passes = int(job["backgroundMatchPasses"])
    if passes < 0:
        raise ValueError("backgroundMatchPasses must not be negative")
    offsets = np.zeros(len(stack))
    with np.errstate(invalid="ignore"):
        for _ in range(passes):
            middle = np.nanmedian(stack - offsets[:, None, None], axis=0)
            step = np.array([np.nanmedian(stack[index] - offsets[index] - middle) for index in range(len(stack))])
            step = np.where(np.isfinite(step), step, 0.0)
            offsets = offsets + step - step.mean()
        levelled = stack - offsets[:, None, None].astype(np.float32)
        contributing = np.sum(np.isfinite(levelled), axis=0)
        combined = np.where(contributing > 0, np.nanmean(levelled, axis=0), np.nan)

    # The grid the frames themselves imply, chosen without looking at the archive's: reported, never used to resample.
    optimal_wcs, optimal_shape = find_optimal_celestial_wcs(list(zip(frame_shapes, frame_wcs)))

    out_header = wcs_out.to_header()
    out_header["BUNIT"] = header["BUNIT"]
    out_header["CHNLNUM"] = header["CHNLNUM"]
    out_header["AORKEY"] = header["AORKEY"]
    out_header["OBJECT"] = header["OBJECT"]
    out_header["INSTRUME"] = header["INSTRUME"]
    out_header["FRAMTIME"] = header["FRAMTIME"]
    out_header["NFRAMES"] = (len(job["frames"]), "level-1 frames combined")
    out_header["COMBINE"] = ("mean", "equal weight per contributing frame")
    out_header["FOOTTHRS"] = (threshold, "least fractional overlap a frame may contribute")
    out_header["BGMATCH"] = (passes, "zero-mean additive background matching passes")
    out_header["ORIGIN"] = "cssEarth tools/objects/spitzer"
    out_header["PIPELINE"] = ("open re-mosaic", "NOT the Spitzer Science Center pipeline")
    fits.PrimaryHDU(combined.astype(np.float32), header=out_header).writeto(job["output"], overwrite=True)

    covered = np.isfinite(combined)
    optimal_centre = optimal_wcs.wcs.crval
    json.dump({
        "frames": len(job["frames"]),
        "shape": [int(shape_out[0]), int(shape_out[1])],
        "stackBytes": int(stack.nbytes),
        "coveredPixels": int(covered.sum()),
        "maxContributingFrames": int(contributing.max()),
        "medianContributingFrames": float(np.median(contributing[covered])) if covered.any() else 0.0,
        "backgroundOffsets": [float(value) for value in offsets],
        "archiveGrid": {
            "shape": [int(shape_out[0]), int(shape_out[1])],
            "crval": [float(header["CRVAL1"]), float(header["CRVAL2"])],
            "pixelScaleArcsec": abs(float(header["PXSCAL2"])),
        },
        "gridImpliedByFrames": {
            "shape": [int(optimal_shape[0]), int(optimal_shape[1])],
            "crval": [float(optimal_centre[0]), float(optimal_centre[1])],
            "pixelScaleArcsec": float(abs(optimal_wcs.wcs.cdelt[1]) * 3600.0),
        },
    }, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: mosaic.py <job.json>")
    main(sys.argv[1])
