/** `answer`, or `fallback()` when the answer fails or has not settled in `patienceMs`; `report` hears why. */
export async function answerOrFallback(answer: Promise<Response>, fallback: () => Promise<Response>, patienceMs: number,
  report: (reason: string) => void): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>(resolve => { timer = setTimeout(resolve, patienceMs, 'late'); });
  let reason: string;
  try {
    const result = await Promise.race([answer, late]);
    if (result !== 'late') return result;
    reason = `no answer in ${patienceMs} ms`;
  } catch (error) {
    reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } finally { clearTimeout(timer); }
  report(reason);
  return fallback();
}
