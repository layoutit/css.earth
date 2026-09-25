# JunoCam

JunoCam is the colour camera on NASA's Juno spacecraft. Its calibrated images reach this project from the PDS Cartography and Imaging Sciences Node, and its geometry from the Juno SPICE kernels NAIF publishes. This guide describes how one image becomes a photograph lens on a body, what was measured on the four images of Europa, and what is not explained. The toolkit ships no lens of its own: a body's package states one, as any other photograph lens.

## Why JunoCam needs its own route

Juno spins twice a minute, and JunoCam has no shutter frame. Its detector carries four fixed filter strips: methane, blue, green and red. While the spin carries the scene across them, the camera reads the strips again and again, 0.37 s apart. One image file is that stack of strips, each 1648 × 128 pixels. A colour image of Europa has 84 of them: 28 frames through three filters.

So an image has no single camera. Each strip was read at its own instant, from its own place, with the spacecraft turned 4.5° further than for the strip before. The [`spice-camera`](../tools/objects/surface-observations/README.md#formats) format reads one camera per image and cannot describe this. The `junocam-camera` format gives every strip its own camera and then joins them.

## Stages

1. **Read the label** ([`junocam.mts`](../tools/objects/terrestrial-layers/junocam.mts)). The PDS3 label states the start time, the delay between frames, the filter order and the size. Only full-resolution calibrated products (`JUNOCAM-RDR`, 16-bit) are accepted. Their samples are reflectance: 10000 is a white Lambertian surface lit at normal incidence at the target's distance from the Sun (product SIS, `SAMPLE_BITS`).
2. **Build one camera per strip.** The instrument kernel `juno_junocam_v03.ti` gives the focal length, pixel pitch, each strip's optical centre, two radial distortion coefficients, a start-time bias of 61.88 ms and an interframe delta of 1 ms. A frame's epoch is the label's start time, plus the bias, plus one delay with its delta per frame. At that epoch the kernels give the spacecraft's position, the camera frame's orientation, the body's orientation and the Sun, with light time and stellar aberration. [`@cssearth/spice`](../packages/spice/README.md)'s `spiceCamera` builds the pinhole camera; the distortion applies on top.
3. **Fit two epochs to the limb** ([`strip-refinement.mts`](../tools/objects/terrestrial-layers/strip-refinement.mts)). The kernel warns that the start time jitters by about 20 ms, and the spin turns the scene 6 pixels in that time. For each image two offsets are fitted to the lit limb that its strips show against the body's mesh: when the pointing is read, and where along its path the spacecraft is taken. Optics, distortion, the interframe delay and the Sun keep their source values. Limb points are split into a fit half and a holdout half. The holdout residual and both offsets must stay within the recipe's budget, or preparation stops.
4. **Join the strips** ([`composite.mts`](../tools/objects/surface-observations/composite.mts)). Only the columns of a strip that can hold lit surface facing the camera are cast onto the mesh. Successive strips of one filter overlap by about 13 rows; a surface point in two strips is sampled in the one that holds it farther from the strip's edge. The strips of one filter make one band, and the red, green and blue bands make one colour photograph: a point is coloured only where all three bands see it.
5. **Share the rest.** Footprints, photometry, selection between photographs, level matching, the display range and the report are the [surface-observation route](../tools/objects/surface-observations/README.md)'s, as for every other photograph.

The kernels live in the shared bank [`src/spice/juno`](../src/spice/juno/manifest.json): only its manifest is committed, and `node tools/kernel-banks/kernel-bank.mts acquire juno` restores every kernel from NAIF (the preparation tools restore the ones they need on their own). The reconstructed trajectory `spk_rec_220909_221019_221027.bsp` carries its own Jupiter system, including the Europa ephemeris the navigation team updated from the flyby, so no separate satellite ephemeris is loaded.

## Measured on Europa

Juno passed Europa on 29 September 2022. With the bank's kernels the closest approach is 09:36:28.9 UTC, 1,915.3 km from Europa's centre, at 23.65 km/s. JunoCam took four colour images 97 to 291 s later, looking back at the sunlit sub-Jovian side. Measured on 19 September 2026.

**The reader against its sources.**

- Juno's position relative to Europa from [`@cssearth/spice`](../packages/spice/README.md) agrees with JPL Horizons' merged Juno trajectory to 1.1 m or better at the four image epochs (the receipt's `horizons` block). This checks the type 1 SPK reader, which no earlier lens used on a spacecraft this fast.
- The labels state the altitude and sub-spacecraft point at mid-image. Evaluated at the start time, this reader gives 95 to 118 km less altitude, which is five seconds of flight at the range rate.
- Strip rays reproduce the field-of-view corner and boresight vectors that the instrument kernel lists for all four strips to 5 × 10⁻⁸ ([`junocam.test.mts`](../tools/objects/terrestrial-layers/junocam.test.mts)). NAIF computed those vectors with its own code, so this settles the distortion inverse and the half-pixel origin.

**The limb fit.** Holdout points are limb points the fit never saw. The numbers are the [receipt](../tools/objects/juno/programs/europa-pj45.registration.json)'s, written by `measure.mts` for the [pinned program](../tools/objects/juno/programs/europa-pj45.json).

| Image | Altitude in label | Pixel at nadir | Pointing epoch | Ephemeris epoch | Holdout residual before | after |
| --- | --- | --- | --- | --- | --- | --- |
| `JNCR_2022272_45C00001_V01` | 1,515 km | 1.14 km | +17.5 ms | +1.115 s | 13.5 px | 0.69 px |
| `JNCR_2022272_45C00002_V01` | 2,738 km | 2.03 km | −4.2 ms | +1.124 s | 6.2 px | 0.61 px |
| `JNCR_2022272_45C00003_V01` | 4,069 km | 2.81 km | +6.1 ms | +1.159 s | 4.1 px | 0.51 px |
| `JNCR_2022272_45C00004_V01` | 5,443 km | 3.71 km | +3.6 ms | +1.153 s | 2.8 px | 0.66 px |

The pointing offsets are inside the kernel's stated jitter. The ephemeris offsets are not explained: see below.

**The four images against each other.** Each image was cast alone and the maps compared patch by patch. They agree to a median of 0.0 to 0.4 km, with 0.5 to 1.4 km of scatter, on map pixels of 3.4 km (patch correlation 0.91 to 0.96).

**Against the USGS mosaic.** Against Europa's Voyager and Galileo mosaic the median offset of image 2 is 0.1 km east and 0.3 km south over 404 patches. The offset changes with longitude, and it changes the same way in all four images, which saw that ground at different places in the field and through different strips: about −9 km east at 0° to 20° E, under 2 km at 20° to 50° E, and +3 to +7 km at 50° to 80° E. A camera error would move with the field position. This one stays with the ground, so it belongs to the mosaic's control, not to these cameras.

**Brightness between images.** The images were taken at phase angles from 81° to 57°. One gain per image brings them to image 1's level: 0.83, 0.86 and 0.91. With the acquisition lighting kept, overlapping images then disagree by 5.8 % (mean log scatter over six pairs). A Lambert division gives the same 5.8 %, and more Lommel-Seeliger weight gives more: 6.7 % at a Lunar-Lambert weight of 0.3, 7.7 % at 0.6, and pure Lommel-Seeliger exceeds the 1.5 × gain budget. The lens keeps the acquisition lighting.

**Cost.** Four images load in 40 s, 15 s of it for image 1, with 1.2 GB of pixel geometry resident. Casting only lit, camera-facing columns took image 1 from 741 MB to 516 MB.

## Not explained

**Every image wants the spacecraft about 1.15 s further along its path.** The fitted ephemeris offsets are +1.12 to +1.16 s, which is 27 km of flight. The same offsets fix two things at once: a sideways shift of the limb that shrinks with distance (13 px at 3,000 km, 4 px at 6,900 km), and a disc about half a percent smaller than predicted. A pointing offset, a focal-length change or a different interframe delay each fit the limb worse, and their fitted values differ from image to image, where this offset is nearly constant. The trajectory itself matches Horizons to a metre, and the spin phase matches the label times to 20 ms, so the labels and the attitude kernel agree with each other and both disagree with the trajectory. The cause is not identified. A clock correlation error between the spacecraft clock and ephemeris time would produce this; that is not verified. The fit reports the offset per image, and the budget in each recipe bounds it.

**The label's clock count is 4.598 s after its start time.** `SPACECRAFT_CLOCK_START_COUNT`, converted with `JNO_SCLKSCET.00211.tsc`, lies 4.598 s after `START_TIME` in all four labels. The product SIS asks analysts to prefer the clock count. At that epoch the spin would point the camera 55° away from Europa, so this route follows the instrument kernel and uses `START_TIME`.

## Limits

- Colour images only: the recipe takes the red, green and blue strips. The methane strip and single-filter images are read by the decoder and have no lens format.
- The colour is JunoCam's band ratios on one display range. It is not a natural-colour reconstruction, and the lens says so.
- The limb fit needs a lit limb in view. An image that shows only surface, with no sky, cannot be fitted this way.
- The fit moves two epochs. It cannot correct a pointing error across the scan; on Europa no such error was left to correct (under 1.2 px when fitted as a third parameter).
- Summed or compressed-only products are refused: `SAMPLING_FACTOR` must be 1 and the product an RDR.
- Exposure time and time-delay integration are read and reported, and not modelled: at Europa they are 6.4 ms and two stages, two pixels of spin.

## Re-running

```sh
source ~/.nvm/nvm.sh && nvm use 24
node tools/kernel-banks/kernel-bank.mts acquire juno
node tools/objects/juno/archive.mts europa-pj45 JNOJNC_0024 EUROPA 502 IAU_EUROPA --orbit 45 --kernels lsk/naif0012.tls,pck/pck00011.tpc,sclk/JNO_SCLKSCET.00211.tsc,fk/juno_v12.tf,ik/juno_junocam_v03.ti,spk/spk_rec_220909_221019_221027.bsp,ck/juno_sc_rec_220925_221001_v01.bc
node tools/objects/juno/measure.mts europa-pj45 output/juno/europa-pj45 --horizons
node tools/objects/juno/archive-ledger.mts
node --test tools/objects/juno/*.test.mts tools/objects/terrestrial-layers/junocam.test.mts tools/objects/terrestrial-layers/strip-refinement.test.mts tools/objects/surface-observations/composite.test.mts tools/objects/surface-observations/junocam.test.mts
pnpm build:spice && pnpm --filter @cssearth/spice test
```

`archive.mts` pins a target's calibrated colour images from a volume's index, by URL and size. `measure.mts` downloads what the work directory lacks (136 MB for Europa; `--raw <dir>` reads files already on disk), adds each digest to the program the first time it holds the bytes, fits every image and writes the receipt. The [archive ledger](junocam-ledger.md) says what else JunoCam photographed. A prepared lens report carries the same fit for the mesh its package states.
