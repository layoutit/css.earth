import assert from 'node:assert/strict';
import { test } from 'node:test';
import { murColormapUrl, murLayer, murWindow, parseMurCapabilities } from './mur-imagery.mts';

// The parts of the GIBS capabilities the reader checks: the layer with its time ranges and default, and the 1 km grid.
const capabilities = (values: readonly string[], latest: string) => `<Capabilities>
<Layer><ows:Identifier>${murLayer}</ows:Identifier><TileMatrixSet>1km</TileMatrixSet><LegendURL xlink:href="${murColormapUrl}"/>
<Dimension><ows:Identifier>Time</ows:Identifier><Default>${latest}</Default>${values.map(value => `<Value>${value}</Value>`).join('')}</Dimension></Layer>
<TileMatrixSet><ows:Identifier>1km</ows:Identifier><TileMatrix><ows:Identifier>6</ows:Identifier><TopLeftCorner>-180 90</TopLeftCorner>
<TileWidth>512</TileWidth><TileHeight>512</TileHeight><MatrixWidth>80</MatrixWidth><MatrixHeight>40</MatrixHeight></TileMatrix></TileMatrixSet>
</Capabilities>`;

test('the week is the newest seven published analyses, and a day NASA never processed stays a gap', () => {
  const { date, dates } = parseMurCapabilities(capabilities(['2026-09-01/2026-09-20/P1D', '2026-09-22/2026-09-28/P1D'], '2026-09-28'), '2026-09-30');
  assert.equal(date, '2026-09-28');
  assert.deepEqual(murWindow(dates, 7), ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']);
  assert.deepEqual(murWindow(dates, 8)[0], '2026-09-20', 'the gap on 21 September is skipped, not filled');
});

test('the capabilities must end their published range on the default date, and never in the future', () => {
  assert.throws(() => parseMurCapabilities(capabilities(['2026-09-01/2026-09-27/P1D'], '2026-09-28'), '2026-09-30'), /does not end on the default date/);
  assert.throws(() => parseMurCapabilities(capabilities(['2026-09-01/2026-10-02/P1D'], '2026-10-02'), '2026-09-30'), /future latest date/);
  assert.throws(() => murWindow(['2026-09-28'], 7), /too few published dates/);
});
