import assert from 'node:assert/strict';
import test from 'node:test';
import { koaRows } from './koa.mts';

test('KOA marks an empty answer and a TOP-bounded one OVERFLOW; both are complete, and any other cut-short answer is refused', () => {
  const overflow = (rows: Record<string, string>[]) => ({ rows, queryStatus: 'OVERFLOW', complete: false });
  const frames = [{ koaid: 'a.fits' }, { koaid: 'b.fits' }, { koaid: 'c.fits' }];
  assert.deepEqual(koaRows("SELECT targname, COUNT(*) AS frames FROM koa_deimos WHERE targname IN ('HD 189733') GROUP BY targname", overflow([])), []);
  assert.deepEqual(koaRows('SELECT TOP 3 koaid FROM koa_hires ORDER BY koaid', overflow(frames)), frames);
  assert.throws(() => koaRows('SELECT TOP 2 koaid FROM koa_hires ORDER BY koaid', overflow(frames)), /KOA cut the answer short \(OVERFLOW, 3 rows\)/u);
  assert.throws(() => koaRows('SELECT koaid FROM koa_hires', overflow(frames)), /KOA cut the answer short/u);
  assert.deepEqual(koaRows('SELECT koaid FROM koa_hires', { rows: frames, queryStatus: 'OK', complete: true }), frames);
});
