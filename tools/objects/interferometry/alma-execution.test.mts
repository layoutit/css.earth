import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrayTimeToDate, parseExecution, readTarHead } from './alma-execution.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name: string) => readFile(resolve(root, 'tests/fixtures/alma', name), 'utf8');

/** A tar stream carrying the named members in order, each padded to the 512-byte block. */
function tarStream(members: readonly { name: string; body: string; long?: boolean }[], truncateAt?: number) {
  const blocks: Buffer[] = [];
  const member512 = (name: string, body: string, type: string) => {
    const header = Buffer.alloc(512);
    header.write(name.slice(0, 100), 0, 'ascii');
    header.write(`${body.length.toString(8).padStart(11, '0')} `, 124, 'ascii');
    header.write(type, 156, 'ascii');
    const payload = Buffer.alloc(Math.ceil(body.length / 512) * 512);
    payload.write(body, 0, 'ascii');
    return [header, payload];
  };
  for (const member of members) {
    // GNU tar writes a long path as a @LongLink member whose body names the member that follows.
    if (member.long) blocks.push(...member512('././@LongLink', `${member.name}\0`, 'L'));
    const header = Buffer.alloc(512);
    header.write(member.long ? member.name.slice(-100) : member.name, 0, 'ascii');
    header.write(`${member.body.length.toString(8).padStart(11, '0')} `, 124, 'ascii');
    header.write('0', 156, 'ascii');
    blocks.push(header);
    const body = Buffer.alloc(Math.ceil(member.body.length / 512) * 512);
    body.write(member.body, 0, 'ascii');
    blocks.push(body);
  }
  const stream = Buffer.concat(blocks);
  return truncateAt === undefined ? stream : stream.subarray(0, truncateAt);
}

test('the head of a tar stream yields the named members and stops there', () => {
  const stream = tarStream([
    { name: 'raw/uid___A002_X1.asdm.sdm/ASDM.xml', body: '<ASDM/>' },
    { name: 'raw/uid___A002_X1.asdm.sdm/._Main.xml', body: 'resource fork' },
    { name: 'raw/uid___A002_X1.asdm.sdm/Main.xml', body: '<MainTable/>' },
    { name: 'raw/uid___A002_X1.asdm.sdm/ASDMBinary/uid___A002_X2', body: 'x'.repeat(4096) },
  ]);
  const found = readTarHead(stream, ['ASDM.xml', 'Main.xml']);
  assert.deepEqual(found.map(member => member.name.split('/').at(-1)), ['ASDM.xml', 'Main.xml']);
  assert.equal(found[1]!.bytes.toString('ascii'), '<MainTable/>');
  // A stream that ends before the wanted members says so rather than returning half an answer.
  assert.throws(() => readTarHead(stream.subarray(0, 600), ['ASDM.xml', 'Main.xml']), /does not reach Main\.xml/u);
  assert.throws(() => readTarHead(stream.subarray(0, 1100), ['Main.xml']), /does not reach/u);
  // The same members behind GNU long-name headers, as ALMA's deeper deliveries write them.
  const deep = 'raw/' + 'nested.uid___A001_X362b_X26a/'.repeat(4) + 'uid___A002_X1.asdm.sdm/';
  const long = tarStream([
    { name: `${deep}ASDM.xml`, body: '<ASDM/>', long: true },
    { name: `${deep}Main.xml`, body: '<MainTable/>', long: true },
  ]);
  const viaLongLink = readTarHead(long, ['ASDM.xml', 'Main.xml']);
  assert.deepEqual(viaLongLink.map(member => member.name.split('/').at(-1)), ['ASDM.xml', 'Main.xml']);
  assert.equal(viaLongLink[0]!.bytes.toString('ascii'), '<ASDM/>');
  assert.ok(viaLongLink[1]!.name.startsWith('raw/nested'), 'the long name replaces the truncated one');
});

test('the execution tables state the antennas, the subscans and what each field costs', async () => {
  const summary = parseExecution(await read('ASDM.xml'), await read('Main.xml'));
  assert.equal(summary.entityId, 'uid://A002/X10ed869/X1ec34');
  assert.equal(summary.created.toISOString().slice(0, 10), '2023-11-03');
  assert.equal(summary.tables.get('Main'), 281, 'the index states the full row count even when the fixture is trimmed');
  assert.ok((summary.tables.get('Antenna') ?? 0) > 0);
  assert.equal(summary.antennas, 41);
  // The fixture keeps twelve of the execution's subscans; each is charged to its own field.
  assert.equal(summary.subscans.length, 12);
  assert.equal([...summary.byField.values()].reduce((sum, totals) => sum + totals.subscans, 0), 12);
  assert.ok(summary.totalDataBytes > 0);
  const first = summary.subscans[0]!;
  assert.equal(first.scan, 1);
  assert.equal(first.antennas, 41);
  assert.ok(first.seconds > 0 && first.seconds < 3600);
  assert.equal(first.start.getUTCFullYear(), 2023);
});

test('an ArrayTime is the modified Julian epoch, and a table without its index is refused', () => {
  // 2023-11-03T07:27:55Z as ALMA writes it: nanoseconds since MJD zero.
  assert.equal(arrayTimeToDate(5205713366544000000).toISOString().slice(0, 10), '2023-11-03');
  assert.throws(() => parseExecution('<ASDM/>', '<MainTable><row><time>1</time></row></MainTable>'), /states its entity/u);
  const index = '<ASDM><Entity entityId="uid://x" entityTypeName="ASDM"/><TimeOfCreation> 2023-11-03T07:27:55.000 </TimeOfCreation></ASDM>';
  assert.throws(() => parseExecution(index, '<MainTable/>'), /lists its tables/u);
  const withTable = index.replace('</ASDM>', '<Table><Name> Main </Name><NumberRows> 1 </NumberRows></Table></ASDM>');
  assert.throws(() => parseExecution(withTable, '<MainTable/>'), /at least one subscan/u);
  assert.throws(() => parseExecution(withTable, '<MainTable><row><scanNumber>1</scanNumber></row></MainTable>'), /states its time, interval/u);
});
