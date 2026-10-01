/** What a body looks like at arrival, apart from who it is: its prepared runtime with its own id written as a placeholder, without
 * the sky it is photographed without, and its delivered images by content. Two bodies with the same look photograph the same, so
 * the second takes the first's photograph byte for byte (packages/bake/cli/prepare-arrival-billboard.mts): 154 Cepheids of M33
 * have 64 temperatures between them, and each was a separate four-second photograph of the same sphere (2026-10-01).
 * Numbers are compared to nine decimals: a pitch of 1.3e-14 degrees, or 88.99999999999999 for 89, is rounding. */
export interface DeliveredImage { readonly filename: string; readonly bytes: number; readonly sha256: string }
export function arrivalLook(id: string, runtime: Readonly<Record<string, unknown>>, images: readonly DeliveredImage[]): string {
  const { sky: _sky, ...drawn } = runtime, anonymous = (text: string) => text.replaceAll(id, '\u0000');
  const scene = anonymous(JSON.stringify(drawn)).replace(/-?\d+\.\d+(?:e[+-]?\d+)?/gu, number => String(Number(Number(number).toFixed(9))));
  return `${scene}\n${images.map(image => `${anonymous(image.filename)} ${image.bytes} ${image.sha256}`).sort().join('\n')}`;
}
