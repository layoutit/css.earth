import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseProcessAnswer, processFailure, raisedProcessFailure } from './parent-process.js';

describe('parent process answers', () => {
  it('a failure is raised again with its class, message, cause and stack', () => {
    const original = new TypeError('Volume reference frame must be a name.', { cause: new Error('frame') });
    const answer = parseProcessAnswer(JSON.parse(JSON.stringify({ failure: processFailure(original) })));
    assert.equal((answer && 'failure' in answer), true);
    const raised = raisedProcessFailure((answer as { failure: ReturnType<typeof processFailure> }).failure);
    assert.ok(raised instanceof TypeError);
    assert.deepEqual(([raised.message, (raised.cause as Error).message, raised.stack]), [original.message, 'frame', original.stack]);
    const named = new Error('no'); named.name = 'ObservationSelectionError';
    assert.equal(raisedProcessFailure(processFailure(named)).name, 'ObservationSelectionError');
  });
  it('only a result or a failure is an answer', () => {
    assert.deepEqual(parseProcessAnswer({ result: { text: 'x\n', code: 3 } }), { result: { text: 'x\n', code: 3 } });
    for (const message of [null, 'x', { result: { text: 1, code: 0 } }, { failure: { name: 'Error' } }, { text: 'x' }]) assert.equal(parseProcessAnswer(message), undefined);
  });
});
