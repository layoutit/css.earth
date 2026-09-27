/** A command run as a child process that answers its parent over the IPC channel. Its own stdout and stderr, and those of
 * every process it starts, are logs; the answer is one message: the result (text and exit code) or the failure (class,
 * message, cause and stack), which the parent raises again as the same class of error. Run without a parent, the command
 * behaves as an ordinary script: it prints its text, and a failure is thrown as usual. */
import { isRecord } from '../validate.js';

export interface ProcessResult { readonly text: string; readonly code: number }
export interface ProcessFailure { readonly name: string; readonly message: string; readonly cause?: string; readonly stack?: string }
export type ProcessAnswer = { readonly result: ProcessResult } | { readonly failure: ProcessFailure };

export function processFailure(error: unknown): ProcessFailure {
  if (!(error instanceof Error)) return { name: 'Error', message: String(error) };
  const cause = error.cause instanceof Error ? error.cause.message : error.cause === undefined ? undefined : String(error.cause);
  return { name: error.name, message: error.message, ...(cause === undefined ? {} : { cause }), ...(error.stack ? { stack: error.stack } : {}) };
}

/** The failure raised again: a TypeError or RangeError keeps its class (a caller maps them to a usage error), any other
 * error is an Error that keeps its name. */
export function raisedProcessFailure(failure: ProcessFailure): Error {
  const options = failure.cause === undefined ? undefined : { cause: new Error(failure.cause) };
  const error: Error = failure.name === 'TypeError' ? new TypeError(failure.message, options)
    : failure.name === 'RangeError' ? new RangeError(failure.message, options) : new Error(failure.message, options);
  error.name = failure.name;
  if (failure.stack !== undefined) error.stack = failure.stack;
  return error;
}

const optionalString = (value: unknown) => value === undefined || typeof value === 'string';

/** A message from the child, read as its answer; anything else is not one. */
export function parseProcessAnswer(message: unknown): ProcessAnswer | undefined {
  if (!isRecord(message)) return undefined;
  const { result, failure } = message;
  if (isRecord(result) && typeof result.text === 'string' && Number.isInteger(result.code)) return { result: { text: result.text, code: Number(result.code) } };
  if (isRecord(failure) && typeof failure.name === 'string' && typeof failure.message === 'string' && optionalString(failure.cause) && optionalString(failure.stack))
    return { failure: { name: failure.name, message: failure.message, ...(failure.cause === undefined ? {} : { cause: String(failure.cause) }),
      ...(failure.stack === undefined ? {} : { stack: String(failure.stack) }) } };
  return undefined;
}

/** Run a command and answer the parent that started it with an IPC channel; without one, print its text and exit with its
 * code, and let a failure throw. */
export async function answerParent(run: () => Promise<ProcessResult | void>): Promise<void> {
  if (!process.send) {
    const result = await run();
    if (result) { process.stdout.write(result.text); process.exitCode = result.code; }
    return;
  }
  // A parent that dies without stopping us (killed outright) closes the channel: end with it, and with the processes we
  // started when we lead our own process group, as the parent's command would have. Our own disconnect after answering is not that.
  let answered = false;
  process.once('disconnect', () => {
    if (answered) return;
    try { process.kill(-process.pid, 'SIGTERM'); } catch { /* Not a process group leader. */ }
    process.exit(129);
  });
  let answer: ProcessAnswer;
  try { const result = await run(); answer = { result: result ?? { text: '', code: 0 } }; }
  catch (error) { answer = { failure: processFailure(error) }; }
  answered = true;
  await new Promise<void>((accept, reject) => { process.send!(answer, undefined, {}, error => { if (error) reject(error); else accept(); }); });
  process.exitCode = 'result' in answer ? answer.result.code : 1;
  process.disconnect?.();
}
