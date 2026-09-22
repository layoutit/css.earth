# IHW/PDS Halley near-nucleus images

The Planetary Data System Small Bodies Node preserves the International Halley Watch Near-Nucleus Studies Network dataset
`IHW-C-NNSN-3-EDR-HALLEY-V2.0`. It is archived and contains 3,523 documented FITS images from 1982-10-16 through 1989-04-12.
The [dataset page](https://pdssbn.astro.umd.edu/holdings/ihw-c-nnsn-3-edr-halley-v2.0/dataset.shtml) is the source for its
scope and status. The PDS warns that these legacy holdings can contain old FITS conventions; this route reads what each label
actually says and does not normalize the pixels into a new scientific product.

[`archive-ledger.mts`](../tools/objects/ihw/archive-ledger.mts) parses the complete fixed-width `FILELIST.TAB`. The committed
[ledger](../data/ihw/ledger.json) retains every product id, archive observation id, observation time, filter, exposure, airmass,
quality description, observatory, telescope, detector, units and pixel sampling. The index's exact bytes are pinned. Filter
names are not converted into wavelength ranges because this dataset does not supply one response curve shared by the whole
collection.

`comet-1p-nnsn1121` qualifies one real product in the clean-room interval: IHW image `NNSN1121`, observation `401132`, a
10-second `GUNN_R` exposure from the Danish 1.5 m reflector at ESO on 1986-03-01. The official PDS label and FITS file are
pinned by byte count, SHA-256 and the MD5 published in `CHECKSUM.TAB`. The index row, label and FITS header agree on the
observation; the image is 396 by 597 pixels at 0.36 arcsec per pixel, and the label rates it `EXCELLENT`.

This is an archive-final relative-intensity image. It has no uncertainty plane, celestial WCS or comet-surface registration,
and no local calibration ran. Its product record therefore carries `archive-origin`, never `archive-agreement`, and the query
leaves wavelength and achieved angular resolution unknown. It is selectable as a telescope product and is not publishable as
a body map.

To regenerate the ledger from the downloaded PDS index:

```sh
pnpm exec node tools/cli/run-typed-module.mjs tools/objects/ihw/archive-ledger.mts FILELIST.TAB --write
```
