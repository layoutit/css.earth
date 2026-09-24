// The prepared-context-navigation tests as oracle scenarios: each test body runs against the injected module, and
// everything its fixtures captured is recorded (publications, flights, selections, URL writes, lens writes, errors).
const harness = await import('../../site/test/.oracle-context-harness.mts');
type Subject = { createPreparedContextNavigation: Parameters<typeof harness.useFactory>[0] };
const settle = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); };
export const scenarios = Object.fromEntries(harness.tests.map(([name, body]) => [name, async ({ subject, record }: { subject: Subject; record: (...values: unknown[]) => void }) => {
  harness.useFactory(subject.createPreparedContextNavigation);
  let failure: unknown = null;
  try { await body(); } catch (error) { failure = error; }
  await settle();
  for (const f of harness.fixtures) record({ content: f.content, flights: f.flights, selections: f.selections, writes: f.writes.map(String),
    errors: f.errors.map(String), lensWrites: f.lensWrites, presentationFocuses: f.presentationFocuses, flightFocuses: f.flightFocuses });
  if (failure) throw failure;
}]));
