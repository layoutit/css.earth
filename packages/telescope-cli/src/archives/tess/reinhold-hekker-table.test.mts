import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReinholdHekker, REINHOLD_HEKKER_2020_TABLE, rowAtPlace, windowOfCampaign } from './reinhold-hekker-table.mts';

// Rows as VizieR's TAP service answers them (cells as text): K2-33 in campaign 2, K2-95 in campaigns 5 and 18,
// and K2-152 in campaign 10, which the route reads as its second part.
const ROWS = [
  { EPIC: '205117205', Campaign: '2', Prot: '6.25', e_Prot: '0.38', HPeak: '0.77', Rvar: '2.54', _RA: '242.56141', _DE: '-19.31927' },
  { EPIC: '211916756', Campaign: '5', Prot: '23.85', e_Prot: '4.1', HPeak: '0.52', Rvar: '0.6', _RA: '127.5', _DE: '19.9' },
  { EPIC: '211916756', Campaign: '18', Prot: '11.38', e_Prot: '1.2', HPeak: '0.41', Rvar: '0.5', _RA: '127.5', _DE: '19.9' },
  { EPIC: '201128338', Campaign: '10', Prot: '15.47', e_Prot: '2', HPeak: '0.4', Rvar: '', _RA: '180.1', _DE: '-4.1' }];

test('a star\'s rows are read by its EPIC number, one entry a campaign', () => {
  const rows = parseReinholdHekker(ROWS);
  assert.equal(rows.size, 3); assert.deepEqual(rows.get(211916756)!.campaigns.map(one => one.campaign), [5, 18]);
  assert.equal(rows.get(205117205)!.campaigns[0]!.variabilityRange, 0.0254); assert.equal('variabilityRange' in rows.get(201128338)!.campaigns[0]!, false);
  assert.throws(() => parseReinholdHekker([ROWS[0]!, ROWS[0]!]), /listed twice/u);
  assert.throws(() => parseReinholdHekker([{ ...ROWS[0]!, Prot: '' }]), /holds no Prot/u);
});

test('a star is found by its place within K2\'s 4 arcseconds', () => {
  const rows = parseReinholdHekker(ROWS).values();
  assert.equal(rowAtPlace(rows, [{ raDegrees: 0, decDegrees: 0 }, { raDegrees: 242.56141 + 2 / 3600, decDegrees: -19.31927 }])?.epic, 205117205);
  assert.equal(rowAtPlace(parseReinholdHekker(ROWS).values(), [{ raDegrees: 242.56141 + 6 / 3600, decDegrees: -19.31927 }]), undefined);
});

test('the verdict is the paper\'s period on the campaigns it lists, by its rule for a star seen twice', () => {
  const rows = parseReinholdHekker(ROWS), judge = REINHOLD_HEKKER_2020_TABLE.judge;
  assert.deepEqual(judge(rows.get(205117205)!, [2, 15]), { verdict: { detected: true, periodDays: 6.25, amplitude: 0.0254 }, windows: [2], gives: 6.25 });
  // Campaigns that deviate by more than 20% of their mean give no verdict, as the paper excludes such a star.
  assert.match(judge(rows.get(211916756)!, [5, 18]).verdict.reason!, /23\.85 and 11\.38 d in campaigns 5 and 18, which deviate by more than the 20%/u);
  // Campaign 10 is read as its second part; a campaign MAST does not serve leaves the verdict unread.
  assert.equal(windowOfCampaign(10), 102); assert.deepEqual(judge(rows.get(201128338)!, [10]).windows, [10]);
  assert.match(judge(rows.get(205117205)!, [15]).verdict.reason!, /no light curve of the star for that campaign at MAST now \(campaign 2\)/u);
});
