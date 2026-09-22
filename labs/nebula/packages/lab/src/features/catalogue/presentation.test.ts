import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { readMessierPresentation } from './presentation';
import { validateThumbnail } from '../../cli/commands/catalogue/acquire-messier-presentation.ts';

test('complete presentation pins real cutouts independently of object extents', async () => {
  const presentation = readMessierPresentation(JSON.parse(await readFile('labs/nebula/models/messier/presentation.json', 'utf8')));
  assert.equal(presentation.objects.length, 110);
  for (const object of presentation.objects) {
    assert.equal(object.thumbnail.width, 192); assert.equal(object.thumbnail.height, 192);
    const url = new URL(object.thumbnail.url);
    assert.equal(url.searchParams.get('hips'), 'CDS/P/DSS2/color');
    assert.equal(url.searchParams.get('format'), 'jpg');
    assert.ok(Math.abs(Number(url.searchParams.get('fov')) * 3600 - object.thumbnail.fieldArcsec) < 0.000001);
  }
  const lagoon = presentation.objects.find(o => o.objectId === 'm8')!;
  assert.equal(lagoon.extent?.majorArcsec, 5400);
  assert.equal(lagoon.displayType, 'diffuse-nebula');
  assert.notEqual(lagoon.extent?.majorArcsec, lagoon.thumbnail.fieldArcsec);
  assert.match(presentation.objects.find(o => o.objectId === 'm40')!.extent!.label, /pair separation/i);
  assert.equal(presentation.objects.find(o => o.objectId === 'm73')!.extent, undefined);
});

test('missing pins, unsafe paths and duplicate objects fail validation', async () => {
  const original: unknown = JSON.parse(await readFile('labs/nebula/models/messier/presentation.json', 'utf8'));
  const missing = structuredClone(readMessierPresentation(original));
  delete missing.objects[0]!.thumbnail.bytes;
  assert.throws(() => readMessierPresentation(missing), /Unpinned/);
  const escaped = structuredClone(readMessierPresentation(original));
  escaped.objects[0]!.thumbnail.localPath = '../../secret';
  assert.throws(() => readMessierPresentation(escaped), /thumbnail/);
  const duplicated = structuredClone(readMessierPresentation(original));
  duplicated.objects[1] = duplicated.objects[0]!;
  assert.throws(() => readMessierPresentation(duplicated), /duplicate/);
});

test('thumbnail decoder rejects changed pixels and incorrect dimensions', async () => {
  const bytes = await sharp({ create: { width: 192, height: 192, channels: 3, background: '#203050' } }).jpeg().toBuffer();
  const receipt = await validateThumbnail(bytes);
  assert.equal(receipt.width, 192);
  const wrong = await sharp(bytes).resize(128, 128).jpeg().toBuffer();
  await assert.rejects(validateThumbnail(wrong), /192/);
  await assert.rejects(validateThumbnail(Buffer.from('<html>error</html>')), /JPEG/);
});
