// Keep native property assignment distinct from cssText serialization. Prepared
// matrix text must take the same CSSOM path as the original retained publisher.
export function readPreparedStyle(style: CSSStyleDeclaration, name: string): string {
  if (name.startsWith("--")) return style.getPropertyValue(name);
  const value: unknown = Reflect.get(style, name);
  if (typeof value !== "string") throw new TypeError(`Unknown prepared style property: ${name}.`);
  return value;
}
export function writePreparedStyle(style: CSSStyleDeclaration, name: string, value: string): void {
  if (name.startsWith("--")) style.setProperty(name, value);
  else Reflect.set(style, name, value);
}

/** Prepared colors use space-separated RGB; CSSOM reads them back with commas. */
export function samePreparedStyle(current: string, name: string, value: string): boolean {
  if (current === value) return true;
  if (name.startsWith('--') || !(name === 'color' || name.endsWith('-color') || name.endsWith('Color'))) return false;
  const rgb = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(value);
  return rgb !== null && current === `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
}
