/** The disc's CSS box. It is one flat color whose edge stays inside the globe, so its box only sets the backing store a
 * browser allocates for its 3D layer: 512 px was 9.4 MB at 3x on every body page, 128 px is 0.6 MB. */
export const PREPARED_INTERIOR_DISC_SIZE = 128;
