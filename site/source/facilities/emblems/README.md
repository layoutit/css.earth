# Spacecraft emblems

The 24 mission entries use permanent transparent PNGs from pinned emblem sources. Most originate on Wikimedia Commons; Hayabusa and Hayabusa2 use JAXA and Rosetta uses ESA. Each original or served derivative, source URL, credit and SHA-256 is retained in source-records.json and ../emblem-library.json. Hubble uses NASA's 25th-anniversary badge, explicitly identified in its source description.

Normal app builds only verify and reuse the PNGs. To reproduce them explicitly, run:

    node tools/prepare/prepare-facility-emblems.mts
    node tools/prepare/cli/prepare-facilities.mts

An optional absolute PNG path supplied to the first command writes a contact sheet. The preparation removes only edge-connected exterior white background on opaque inputs. Interior artwork RGB is kept intact before resizing. Existing alpha remains intact. Juno's source vector is placed over its original white circular badge interior, preserving transparency outside the circle. Output frames are 128 by 128 with two pixels of transparent padding, published as a palette PNG (at most 129 colours, exact transparency): they show at 64 CSS px beside a facility render.

The original source artwork remains subject to its source-page terms. Hayabusa's source page describes its patch as private-use material; these local preview assets do not assert permission for public redistribution.
