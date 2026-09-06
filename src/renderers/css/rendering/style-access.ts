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
