export type ChannelGain = readonly [number, number, number];

export function validateChannelGain(value: unknown): ChannelGain {
  if (!Array.isArray(value) || value.length !== 3 ||
    value.some(channel => typeof channel !== 'number' || !Number.isFinite(channel) || channel <= 0 || channel > 4))
    throw new TypeError('A dataset channel gain must be three finite multipliers in (0,4].');
  return [value[0] as number, value[1] as number, value[2] as number];
}

