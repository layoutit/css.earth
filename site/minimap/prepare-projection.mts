export function minimapDataOnly(args: readonly string[]): boolean {
  if (args.length > 1 || args.some(arg => arg !== '--data-only')) throw new TypeError('Usage: prepare.mts [--data-only]');
  return args.includes('--data-only');
}

/** The projection is a published image, not a TypeScript input. Ordinary preparation still always writes it. */
export async function prepareMinimapProjection(dataOnly: boolean, project: () => Promise<void>): Promise<void> {
  if (!dataOnly) await project();
}
