/** Opacity below half an 8-bit step cannot change a composited pixel. Coverage
 * anchors keep their prepared floor and stay shown at any positive luminance. */
export const IMPERCEPTIBLE_LUMINANCE = 0.5 / 255;
