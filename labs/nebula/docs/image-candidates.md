# LMC image candidates — awaiting approval

Open [Alignment](http://127.0.0.1:4331/?subject=lmc-clouds&tab=alignment). Only image previews were prepared. No new cloud decomposition or volume bake has run. Existing SMASH reconstruction and catalog-star positions remain unchanged. User sign-off is required before processing candidates further.

| Candidate | Official origin and usable source | Coverage and current decision |
| --- | --- | --- |
| Current SMASH | [NSF NOIRLab / CTIO / SMASH](https://noirlab.edu/public/images/noirlab2030a/); original 6737 × 6536 TIFF | About 9.35° × 9.07°. Current color source and sky-coordinate anchor; partial simulated-density coverage. |
| VISTA infrared | [ESO / VMC](https://www.eso.org/public/images/eso1914a/); 8954 × 10000 publication TIFF from the 28638 × 31985 mosaic | About 7.7° × 8.6°. High-detail Y/J/Ks display composite; does not solve the outer-coverage gap. Corrected matched-star registration passes; awaiting visual approval. |
| WISE wide infrared | [NASA/IPAC WISE](https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html), rendered by CDS from W4/W2/W1 | 6000 × 6000 over 24°, ~14.6″/pixel centrally. No empty pixel coverage, but atlas color/brightness seams cross the LMC. Independent star matching has not passed. Comparison only; not ready for a cloud bake. |

The previews are bounded at 4096/6000 pixels. Original downloads remain pinned in the ignored local cache. Infrared display colors are not visible-light colors. NASA supplied the WISE mission data; the RGB stretch is CDS processing, not a NASA-authored RGB image.

## VISTA direction evidence

Detected compact-source maps were extracted before matching. 16,020 discrete star identities agree with surrounding-star patterns; 5,340 were held out of the final fit. Their median residual is 0.276 native SMASH pixels and P90 is 0.667 pixels (~3.3″). The matched convex hull covers 83.1% of VISTA; its remaining outer corners are extrapolated. Shifted-star controls produce zero confirmed patterns; mirror, rotation and scale controls fail.

The publisher VISTA WCS alone fails this check (median 37.2 SMASH pixels). The active overlay uses the exact verified homography, not a forced rotation-only approximation or the old manual fit. SMASH AVM supplies the absolute sky anchor; this is a relative image registration, not an independent absolute astrometric solution or a match of simulated particles to individual observed stars. [Pinned direction receipt](../models/lmc-candidates/source/vista-direction-gate.json).

## Further research

- [SMASH DR2 science images](https://datalab.noirlab.edu/data/smash) cover 68 contiguous LMC fields spanning roughly 15° × 18.5°, with ~1″ seeing; 25 are deep and 43 shallow. A wider optical composite needs native field assembly and actual footprint masks; the field union is not a guaranteed complete rectangle.
- [DeMCELS DR1](https://datalab.noirlab.edu/data/demcels) provides fine Hα/[SII] emission and continuum-subtracted tiles over the central ~54 square degrees. It is a future gas-detail source, not a replacement covering the whole stellar outskirts.
- [NASA Spitzer SAGE](https://irsa.ipac.caltech.edu/data/SPITZER/SAGE/overview.html) provides useful infrared dust imagery and point-source-subtracted residuals, but its ~7° × 7° survey also misses the wider simulated field.

No verified ready-made image found in this audit combines complete 20–25° coverage, ~1″ detail and a clean diffuse-color mosaic. The 19.25° model extent encloses 90% of simulated stellar particles, not observed gas emission; extending the image canvas does not establish luminous nebula everywhere.

## After approval

Extract and retain compact-star maps before cloud decomposition for every new source. Inspect the diffuse color remaining after separation, its background/noise and any saturation. Preserve the full source footprint and no-data mask. Any chosen tone curve must apply globally to the source; do not normalize slices independently. Bake only with the verified registration, retain source credits and compare a rotated reconstruction before accepting it.
