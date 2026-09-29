/** Records name their inputs and outputs by path. A field that recorded a content digest was removed; a record that
 * still carries one is refused rather than silently read. `at` names the record for the error. */
export function refuseDigestFields(value: Readonly<Record<string, unknown>>, at: string): void {
  for (const key of Object.keys(value)) {
    if (/sha256/iu.test(key)) throw new TypeError(`${at} carries the removed content digest field ${key}: ${JSON.stringify(value[key])}.`);
  }
}
