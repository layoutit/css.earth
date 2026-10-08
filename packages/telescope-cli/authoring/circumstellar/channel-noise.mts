/** The per-pixel noise of the mean of the displayed channels, from each band's own noise.
 *
 * A band counts once, for its whole share of that mean. An image of one band fills every channel with the same plane, so the
 * mean is that plane and carries its noise whole; counted as independent readings, three channels of one band gave the noise
 * over the square root of three, and every limit stated in multiples of the noise acted 0.58 times lower than written.
 * Channels that share no band keep the sum they always had, so their datasets are authored to the same bytes. */
export function meanChannelNoise(channels: readonly (readonly string[])[], noiseOf: (band: string) => number): number {
  const named = channels.flat();
  if (new Set(named).size === named.length)
    return Math.sqrt(channels.reduce((total, bands) => total + bands.reduce((sum, band) => sum + noiseOf(band) ** 2, 0) / bands.length ** 2, 0)) / channels.length;
  const share = new Map<string, number>();
  for (const bands of channels) for (const band of bands) share.set(band, (share.get(band) ?? 0) + 1 / (channels.length * bands.length));
  return Math.hypot(...[...share].map(([band, part]) => part * noiseOf(band)));
}
