import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';

const site = new URL('../', import.meta.url);
const sources = async () => {
  const files = (await readdir(site, { recursive: true })).filter(file => /\.(astro|mts)$/u.test(file) && !/(^|\/)(test|node_modules)\//u.test(file) && !/\.test\.mts$/u.test(file));
  return Promise.all(files.map(async file => ({ file, text: await readFile(new URL(file, site), 'utf8') })));
};

test('every observation control is a result row with a leading thumbnail: its rules read no detail with :has()', async () => {
  // The row's grid and its hidden leader come from the result row's own rule (maps-shell.css). A control written without
  // those classes would fall back to the plain two-column row, with no room for a detail.
  const written: string[] = [];
  for (const { file, text } of await sources()) {
    for (const match of text.matchAll(/(["'`])([^"'`\n]*\bobject-observation-control\b(?![-\w])[^"'`\n]*)\1/gu)) {
      const classes = match[2]!;
      if (classes.includes('.object-observation-control')) continue;
      written.push(`${file}: ${classes}`);
      assert.match(classes, /\bobject-thumbnail-leading\b/u, `${file}: ${classes}`);
      assert.match(classes, /\bobject-result-row\b/u, `${file}: ${classes}`);
    }
  }
  assert.ok(written.length >= 4, `the rows' producers were found: ${written.join(' | ')}`);
});

test('the datasets panel is the one tree disclosure, so its summary is its direct child', async () => {
  const users = (await sources()).filter(({ file, text }) => /<TreeDisclosure\b/u.test(text) && !file.endsWith('TreeDisclosure.astro')).map(({ file }) => file);
  assert.deepEqual(users, ['components/ObjectInformationPanel.astro']);
});
