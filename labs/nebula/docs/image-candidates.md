# LMC image candidates

Open [Alignment](http://127.0.0.1:4331/alignment?subject=lmc-clouds). VISTA, Horálek and WISE have verified registration, completed native NOX removals and separately selectable reconstruction bakes. Other images remain catalogue candidates; removing their stars does not automatically select them for a volume bake. The earlier SMASH cloud remains a benchmark. [Method](../METHOD.md) · [Reconstruction](reconstruction.md) · [Alignment evidence](../models/lmc/candidates/source/alignment-report.json).

| Candidate | Publisher and usable source | Coverage and current decision |
| --- | --- | --- |
| SMASH anchor | [NSF NOIRLab / CTIO / SMASH](https://noirlab.edu/public/images/noirlab2030a/); original 6737 × 6536 TIFF | About 9.35° × 9.07°. Benchmark color source and sky-coordinate anchor; partial simulated-density coverage. |
| VISTA infrared | [ESO / VMC](https://www.eso.org/public/images/eso1914a/); 8954 × 10000 publication TIFF from the 28638 × 31985 mosaic | About 7.7° × 8.6°. High-detail Y/J/Ks display composite; does not solve the outer-coverage gap. Corrected matched-star registration passes; processed as a separate reconstruction variant. |
| WISE wide infrared | [NASA/IPAC WISE](https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html), rendered by CDS from W4/W2/W1 | 6000 × 6000 over 24°, ~14.6″/pixel centrally. No empty pixel coverage, but atlas color/brightness seams cross the LMC. Fixed WCS passes independent AllWISE W1 coordinate checks: 34,811 matches, reserved P90 0.632 native pixels. Completed removal/reconstruction variant; seams remain. |
| DSS2 wide optical | [STScI/NASA plates, color by CDS](https://doi.org/10.26093/cds/aladin/ht9n-7r); 6000 × 6000 cutout | 24° field. Broad visible-light context, with plate seams and foreground stars. Restored preview; fixed WCS checked against 566 star patterns, P90 ≈2.01 DSS2 pixels over the central overlap. No fitted correction; outer coverage remains unchecked. [WCS receipt](../models/lmc/candidates/source/dss2-wide-receipt.json), [star check](../models/lmc/candidates/source/dss2-fixed-wcs-star-check.json). |
| Horálek optical | [NOIRLab / Petr Horálek](https://noirlab.edu/public/images/iotw2547a/); 6582 × 4388 source | Complements the central SMASH crop. Matched to 592 SMASH point sources with 198 held out; P90 1.12 native SMASH pixels, 60.2% matched hull. Outer footprint extrapolated. [Registration receipt](../models/lmc/candidates/source/horalek-registration.json). |
| Wider SMASH mosaic | [SMASH survey team](https://smashsurvey.github.io/), also published by [NOIRLab](https://datalab.noirlab.edu/data/smash); original 4111 × 5000 JPEG | Wider irregular field mosaic, retaining missing-data regions and exposure seams. 20,661 matched stars; 6,887 held out, P90 1.82 native reference pixels. Central 30% matched hull; outer footprint extrapolated. Catalogue preview, not native-resolution science FITS. |
| Ciel Austral optical | [Team Ciel Austral](https://www.cielaustral.com/galerie/photo95.htm), [APOD project](https://apod.nasa.gov/apod/ap190503.html); original 14400 × 14200 RHaVBO JPEG | 8192-pixel preview. Optical color enhanced with emission lines; this is the author optical variant, not the APOD narrowband palette. 4,418 matched stars, 1,473 held out, P90 2.015 native SMASH pixels; 74.1% matched hull. Detailed central field, outer area extrapolated. |
| Naztronomy optical | [Nazmus Nasir / Naztronomy](https://www.naztronomy.com/post/71-hour-12-panel-260-megapixel-mosaic-of-the-large-magellanic-cloud); author-hosted 3074 × 3163 JPEG | Available 0.25× preview only; the advertised 160 MP AstroBin version was inaccessible. 4,861 matched stars, 1,621 held out, P90 0.663 native SMASH pixels; 73.9% matched hull. Page says broadband RGB, embedded credit strip says RGB + dual narrowband; preserve that uncertainty and the strip. |

The previews are bounded at up to 8192 pixels on the longest edge; the wider SMASH mosaic retains its native 4111 × 5000 pixels. Original downloads remain pinned in the ignored local cache. Infrared display colors are not visible-light colors. NASA supplied the WISE mission data; the RGB stretch is CDS processing, not a NASA-authored RGB image.

## VISTA direction evidence

Detected compact-source maps were extracted before matching. 16,020 discrete star identities agree with surrounding-star patterns; 5,340 were held out of the final fit. Their median residual is 0.276 native SMASH pixels and P90 is 0.667 pixels (~3.3″). The matched convex hull covers 83.1% of VISTA; its remaining outer corners are extrapolated. Shifted-star controls produce zero confirmed patterns; mirror, rotation and scale controls fail.

The publisher VISTA WCS alone fails this check (median 37.2 SMASH pixels). The active overlay uses the exact verified homography for its registration to SMASH. SMASH AVM supplies the sky anchor; this is a relative image registration, not an independent absolute astrometric solution or a match of simulated particles to individual observed stars. [Pinned direction receipt](../models/lmc/candidates/source/vista-direction-gate.json).

## Shared model fit in Alignment

All catalogue previews retain the existing saved user-authored model fit: scale 3, +39° rotation and translation (−1.2, −1.7, 0) kpc about the SMASH image centre. Each candidate receives the same transform with its own centre compensated, so the VISTA-to-SMASH matched-star registration remains intact. This restores the accepted inspection placement; the scale and rotation do not establish scientific size or simulated-to-observed correspondence. WISE keeps its publisher WCS, now verified against AllWISE W1 catalogue positions; its diffuse colors and seams are not validated by that positional check.

The prepared VISTA and SMASH CSS geometry agrees with the measured homography to floating-point precision. Their held-out star residuals remain the evidence for image-to-image alignment; the shared model fit is a separate display choice. No source pixels, textures or cloud products changed when this placement was restored.

## Further research

- [SMASH DR2 science images](https://datalab.noirlab.edu/data/smash) cover 68 contiguous LMC fields spanning roughly 15° × 18.5°, with ~1″ seeing; 25 are deep and 43 shallow. The author-published 4111 × 5000 mosaic is now available as an alignment preview. A native-resolution optical composite would still require scientific field assembly and actual footprint masks; the field union is not a guaranteed complete rectangle.
- [DeMCELS DR1](https://datalab.noirlab.edu/data/demcels) provides fine Hα/[SII] emission and continuum-subtracted tiles over the central ~54 square degrees. It is a future gas-detail source, not a replacement covering the whole stellar outskirts.
- [NASA Spitzer SAGE](https://irsa.ipac.caltech.edu/data/SPITZER/SAGE/overview.html) provides useful infrared dust imagery and point-source-subtracted residuals, but its ~7° × 7° survey also misses the wider simulated field.

No verified ready-made image found in this audit combines complete 20–25° coverage, ~1″ detail and a clean diffuse-color mosaic. The 19.25° model extent encloses 90% of simulated stellar particles, not observed gas emission; extending the image canvas does not establish luminous nebula everywhere.

## After approval

Extract and retain compact-star maps before cloud decomposition for every new source. Inspect the diffuse color remaining after separation, its background/noise and any saturation. Preserve the full source footprint and no-data mask. Any chosen tone curve must apply globally to the source; do not normalize slices independently. Bake only with the verified registration, retain source credits and compare a rotated reconstruction before accepting it.

## Wider SMASH preview provenance

The preview is the actual published survey mosaic, not an upscale of NOIRLab’s 1500-pixel copy or an assembly of the current cropped photograph. Both publisher versions show the same scene. [Source receipt](../models/lmc/candidates/source/smash-mosaic-acquisition.json) pins an immutable survey-repository URL and original bytes. Black field gaps represent missing observations; they are not measured zero light. Exposure/color seams remain visible.

[Star registration](../models/lmc/candidates/source/smash-mosaic-registration.json) uses observed compact point sources and held-out matches to the current SMASH image. The reference photograph limits the matched hull to the central 30%; the outer footprint is extrapolated. This image supplies a candidate sky projection, not measured cloud depth.

An independent [DSS2 outskirts check](../models/lmc/candidates/source/smash-mosaic-outskirts-check.json) finds 2,138 corresponding star patterns beyond the smaller SMASH photograph. Its P90 of 2.71 native DSS2 pixels fails the 2.5-pixel precision limit; it supports the broad direction without upgrading the outer footprint to a precision-validated registration. No correction was fitted from that check. [Replay procedure and source hashes](../models/lmc/candidates/source/smash-registration/README.md) retain the exact registration helpers and failed check.

## Amateur optical comparison candidates

Both candidates pass the unchanged discrete-star registration gates before entry into Alignment. Their exact homographies retain source-native pixel coordinates and the same SMASH sky anchor. The accepted shared manual image-to-density display fit is applied separately. Neither image has a measured correspondence to individual simulated stars or proven coverage of the full density cloud.

- Ciel Austral: [source and copyright](../models/lmc/candidates/source/ciel-austral-source.json), [direction gate](../models/lmc/candidates/source/ciel-austral-registration.json), [replay](../models/lmc/candidates/source/ciel-registration/README.md).
- Naztronomy: [source, accessible resolution and caption discrepancy](../models/lmc/candidates/source/naztronomy-source.json), [direction gate](../models/lmc/candidates/source/naztronomy-direction-gate.json), [replay](../models/lmc/candidates/source/naztronomy-registration/README.md).

Downloaded originals stay in the ignored cache. The app uses bounded 2D previews with original credits retained. APOD inclusion does not make a photograph NASA-owned or confer an open reuse license. These images are comparison candidates; their import and star alignment do not select them for cloud processing.
