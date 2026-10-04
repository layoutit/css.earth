/** Hosts select their assertion implementation; objects never imports Node assertions. */
export interface DeliveryAssertion {
  ok(value: unknown, message: string): asserts value;
  equal(actual: unknown, expected: unknown, message?: string): void;
}
export interface DeliveryValidationPolicy {
  /** Defaults to allow: historical delivery readers admit unknown envelope and pin fields. */
  extraKeys?: 'allow' | 'reject';
  /** Required: supply node:assert/strict to retain historical AssertionError diagnostics. */
  assertion: DeliveryAssertion;
}
export function assertionExpression(expression: string): string {
  return `The expression evaluated to a falsy value:\n\n  ${expression}\n`;
}
export function rejectDeliveryExtraKeys(value: Record<string, unknown>, keys: readonly string[], policy: DeliveryValidationPolicy): void {
  if (policy.extraKeys === 'reject') policy.assertion.ok(Object.keys(value).every(key => keys.includes(key)), 'Unexpected delivery fields.');
}
