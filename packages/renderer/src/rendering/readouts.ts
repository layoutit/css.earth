/** What an owner reports about one of its elements for tests and diagnostics: a count, a rounded opacity, a leaf's
 * prepared id. A readout is kept beside the element, never on it: an attribute is a DOM write the page pays for on every
 * change and a value every stylesheet attribute rule is matched against, and no page reads these. Attributes are for
 * what a stylesheet, a selector or an assistive technology reads. */
const readouts = new WeakMap<object, Record<string, string>>();

export function setReadout(element: object, key: string, value: string): void {
  const held = readouts.get(element);
  if (held) held[key] = value; else readouts.set(element, { [key]: value });
}

export function readout(element: object, key: string): string | undefined { return readouts.get(element)?.[key]; }

/** Every readout of an element, for a test that compares several at once. */
export function readoutsOf(element: object): Readonly<Record<string, string>> { return readouts.get(element) ?? {}; }
