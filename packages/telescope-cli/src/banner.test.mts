import assert from 'node:assert/strict';
import test from 'node:test';
import { BANNER, WORDMARK } from './banner.mts';

// Frozen glyphcss output, including literal backslashes and the wordmark backtick.
const expected = [
  "             .####.#..##..#",
  "           ...####..##......#",
  "         .....########........#",
  "        .....########..........#",
  "       .......###..#...........##",
  "       ........##..............##",
  "       ..............###.........",
  "       .............#######......",
  "        ............#########...",
  "         .............######...",
  "           ...........###....",
  "             ........#.....",
  "",
  "                               _   _",
  "  ___ ___ ___   ___  __ _ _ __ | |_| |__",
  " / __/ __/ __| / _ \\/ _` | '__| __| '_ \\",
  "| (__\\__ \\__ \\|  __/ (_| | |  | |_| | | |",
  " \\___|___/___(_)___|\\__,_|_|   \\__|_| |_|"
].join('\n') + '\n';

test('the exported banner preserves every baked line and its trailing newline', () => {
  assert.equal(BANNER, expected);
  assert.deepEqual(WORDMARK, expected.trimEnd().split('\n').slice(13));
  assert.equal(WORDMARK.length, 5);
});
