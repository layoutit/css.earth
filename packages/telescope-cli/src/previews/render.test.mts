import assert from 'node:assert/strict';
import test from 'node:test';
import { renderImage, renderPreview, renderSpectrum } from './render.mts';
import type { PreviewState, SpectrumPreview } from './types.mts';

const spectrum = (y: readonly number[]): SpectrumPreview => ({ kind: 'spectrum', x: y.map((_, i) => 300 + i * 10), y, xunit: 'nm', yunit: 'erg/s/cm²/Å' });
function frame(lines: readonly string[]) {
  assert.equal(lines.length, 12); assert.ok(lines.every(line => Array.from(line).length === 40)); assert.ok(lines.every(line => !line.includes('\x1b')));
}

test('all preview states occupy the same 12 by 40 plain-text frame', () => {
  const states: PreviewState[] = [{ kind: 'loading' }, { kind: 'none', reason: 'the archive has no preview for this one' },
    { kind: 'failed' }, { kind: 'failed', reason: 'line\nbreak\x1b' }, spectrum([1, 2, -3, 4]),
    { kind: 'image', grid: [[0, 0.5, 1]], caption: 'SPHERE image · ESO data' }];
  for (const state of states) frame(renderPreview(state));
  assert.equal(renderPreview(states[1]!)[1]!.trim(), 'no preview');
  assert.equal(renderPreview(states[1]!)[2]!.trim(), 'the archive has no preview for this one');
});

test('two-pass spectra keep the y axis at column 5 and x labels on row 10 across units/signs', () => {
  for (const y of [[1, 2, 3, 4], [-4, -1, 3, 2], [1e-11, 2e-11, -1e-11, 4e-11], [0, 0, 0, 0], [1e6, 2e6, -1e6, 4e6]]) {
    const lines = renderSpectrum(spectrum(y)); frame(lines);
    const axes = lines.slice(0, 11).filter(line => /[│┤└├┼]/u.test(line));
    assert.ok(axes.length > 0); assert.ok(axes.every(line => line.search(/[│┤└├┼]/u) === 5));
    assert.match(lines[10]!, /\d/u); assert.doesNotMatch(lines[10]!, /[─│┤└├┼]/u);
    assert.doesNotMatch(lines.slice(0, 11).join('\n'), /[─┬├┼]/u);
    // Glyphcss treats ticks:3 as a target and chooses nice values; the approved mock uses the same rule.
    assert.ok(lines.slice(0, 10).filter(line => line.includes('┤')).length <= 3);
  }
  assert.equal(renderSpectrum(spectrum([1e-11, 2e-11, -1e-11, 4e-11]))[11]!.trim(), 'y ×10⁻¹¹ erg/s/cm²/Å · x nm');
});

test('images use the approved ramp over 30 by 11 cells with the caption in the last row', () => {
  const lines = renderImage({ kind: 'image', grid: [Array.from({ length: 10 }, (_, i) => i / 10)], caption: 'SPHERE image · ESO data' }); frame(lines);
  assert.equal(lines[0], '   ...:::---===+++***###%%%@@@          ');
  assert.ok(lines.slice(0, 11).every(line => line === lines[0]));
  assert.equal(lines[11]!.trim(), 'SPHERE image · ESO data');
  assert.throws(() => renderImage({ kind: 'image', grid: [], caption: '' }), /invalid/u);
});
