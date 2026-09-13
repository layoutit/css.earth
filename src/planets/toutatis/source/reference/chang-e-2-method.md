# Chang’e-2 approximate photo projection

## Sources and placement

[Jiang et al. (2015), Figure 1c](https://pmc.ncbi.nlm.nih.gov/articles/PMC4629198/#f1)
shows the complete asteroid at a stated range of 67.7 km and original sampling
of 8.3 m/pixel. The published figure is enlarged, not the native detector image.
The closer frames are partly blocked by a solar panel. The paper did not register
these images to a shape model. Our crop is x=3, y=790, width=804, height=714 in
the pinned 1575 × 1506 JPEG. Only this CC BY 4.0 image supplies displayed texels.

The projection uses the same Hudson–Ostro–Scheeres mesh as Shape: coordinates
are metres after the OBJ's kilometre conversion, with +Z toward the small head.
The mesh and image hashes are bound into the
[recipe](../preparation/terrestrial.json). A different mesh requires a new
projection; these parameters cannot silently carry over.

[Zou et al. (2014), DOI 10.1016/j.icarus.2013.11.002](https://doi.org/10.1016/j.icarus.2013.11.002)
provides the orientation diagram (Figure 3), paired optical/radar render
(Figure 4), and feature comparison (Figure 7). The publisher's full figures
were examined; the complete article was not retrieved.
[Bu et al. (2015)](https://doi.org/10.1088/0004-6256/149/1/21) quotes the three
rotation angles, −33.8°, 33° and 47.1°. The assumed active rotation is
Ry(−47.1°) Rx(33°) Rz(−33.8°), with image right +X, image up +Z and viewer −Y.
This interpretation and the figure framing remain approximate; Bu's two
endpoints do not provide a distributed surface control network.

With right, up and eye vectors in the recipe, projection is:

```text
x = 506.049838733906 + 0.2181544838418488 × dot(pointMetres, right)
y = 354.726863249610 − 0.2181544838418488 × dot(pointMetres, up)
```

The original 800 px diagnostic render used scale 0.24058945005993798 px/m and
centre (445.49196441566687, 413.92540749888065). Manual framing to Zou's radar
panel used scale 558/800 and translation (17, −22). The photo-to-photo transform
from Zou's optical panel to the Jiang crop used scale 1.3 and translation (80, 8).
The final parameters above preserve the visually accepted trial.

Two image windows set the photo-to-photo transform; three disjoint windows had
local offsets of 2.24, 1.00 and 1.41 enlarged-figure pixels, with correlations
0.937, 0.892 and 0.922. **These compare two photographs, not photo pixels with
3D surface coordinates.** They establish neither native detector precision nor
absolute placement. The report therefore always records registration as
approximate and unqualified.

## Transfer and display

- A hand-traced polygon, inset by 20 figure pixels, excludes annotations, the
  shadowed upper edge and the limb. Brightness never grants coverage.
- Parallel rays hit the full 39,996-facet model. Interpolated source normals
  reject emission angles above 60°. No Sun direction or photometric correction
  is inferred from the image.
- Each point on the 800-triangle display mesh must have a nearest source point
  within 50 m. All four bilinear image contributors must pass the mask and
  geometry checks; each must lie within two of its projected pixel diagonals.
  A separate full-mesh ray checks visibility to 0.01 m numerical tolerance.
- RGB interpolation preserves the published display levels, followed by WebP
  encoding. There is no second sRGB transfer, white balance or albedo claim.
  Rejected samples use the shared grid. Shadows default off.

The orthographic ray-start plane is numerical scaffolding, not the measured
spacecraft position. Reports leave the latter null. A projected figure pixel's
footprint is about 4.58 m under this assumption; it is not 4.58 m native detail.
The area report estimates where this projection supplies accepted samples on
the display mesh. It is not a measurement of securely registered coverage.

## Remaining uncertainty

The radar model differs from the optical surface, particularly at the large
lobe and neck. A 50 m display-to-source bound limits mesh transfer, not the
photograph's unknown placement error. Matching an outline or visually approving
the result cannot resolve that error. Craters and boulders must not be used as
measured geographic landmarks in this view.

[Zhao et al. (2015)](https://doi.org/10.1093/mnras/stv792) uses a different radar
model; its attitude cannot be transplanted without establishing the model frame.
[Zhao et al. (2016)](https://doi.org/10.1016/j.pss.2016.03.008) describes optical/
radar fusion, but no matching released mesh and independent controls were
retrieved. A future dataset can use that matching geometry if it becomes
available. Accurate registration remains deferred.
