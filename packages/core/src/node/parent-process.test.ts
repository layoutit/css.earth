import { describe, expect, it } from 'vitest';
import { parseProcessAnswer, processFailure, raisedProcessFailure } from './parent-process.js';

describe('parent process answers', () => {
  it('a failure is raised again with its class, message, cause and stack', () => {
    const original = new TypeError('Volume reference frame must be a name.', { cause: new Error('frame') });
    const answer = parseProcessAnswer(JSON.parse(JSON.stringify({ failure: processFailure(original) })));
    expect(answer && 'failure' in answer).toBe(true);
    const raised = raisedProcessFailure((answer as { failure: ReturnType<typeof processFailure> }).failure);
    expect(raised).toBeInstanceOf(TypeError);
    expect([raised.message, (raised.cause as Error).message, raised.stack]).toEqual([original.message, 'frame', original.stack]);
    const named = new Error('no'); named.name = 'ObservationSelectionError';
    expect(raisedProcessFailure(processFailure(named)).name).toBe('ObservationSelectionError');
  });
  it('only a result or a failure is an answer', () => {
    expect(parseProcessAnswer({ result: { text: 'x\n', code: 3 } })).toEqual({ result: { text: 'x\n', code: 3 } });
    for (const message of [null, 'x', { result: { text: 1, code: 0 } }, { failure: { name: 'Error' } }, { text: 'x' }]) expect(parseProcessAnswer(message)).toBeUndefined();
  });
});
