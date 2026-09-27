# Pluto small moons: preserve and resolve native-image blockers

Proposal 106 · **Blocked by existing evidence** · Priority 3

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Nix/Hydra photographic registration is deferred, Nix MVIC color is excluded for inadequate spatial information, and Kerberos/Styx have unresolved source limits.

Use OPUS to document exact candidate/control products and their overlap with existing failed trials; reopen a surface only when its recorded condition is met.

Content owners: [nix](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/nix/README.md), [hydra](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/hydra/README.md), [kerberos](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/kerberos/README.md), [styx](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/styx/README.md).

## Evidence

OPUS provides LORRI/MVIC records and calibrated-file links. Existing Nix evidence estimates roughly 24×17 color pixels, inadequate for the required cross-band registration; the indexed image dimensions describe the detector, not the moon.

## Work

Compare identifiers, pointing and source-model bindings with the existing ledgers. Seek independent control or a newly released registered product; distinguish matching metadata from a successful shape-frame solution.

## Limits and prior decisions

No geometry changes, no coarse color transferred onto finer LORRI detail, and no repeated failed fit presented as new evidence. Styx has no intended-target MVIC row in this snapshot; that is not proof that it never appears in a frame.

## Acceptance

Meet the existing disjoint interior-holdout and source-frame conditions on genuinely new evidence. An unchanged blocker remains blocked and does not justify a rendered dataset.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [nh-mvic-mc0_0299154512](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Nix&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 2015-07-14T04:36:40.007. [Read native label](../evidence/labels/nix-bands.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPEMV_2001/data/20150714_029915/mc0_0299154512_0x545_sci.lbl).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

7 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| New Horizons LORRI | [Hydra](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Hydra&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 191 | prior-limit |
| New Horizons LORRI | [Kerberos](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Kerberos&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 100 | prior-limit |
| New Horizons LORRI | [Nix](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Nix&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 102 | prior-limit |
| New Horizons LORRI | [Styx](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Styx&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 54 | prior-limit |
| New Horizons MVIC | [Hydra](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Hydra&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12 | prior-limit |
| New Horizons MVIC | [Kerberos](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Kerberos&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 5 | prior-limit |
| New Horizons MVIC | [Nix](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Nix&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 17 | prior-limit |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
