import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const packageRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(packageRequire.resolve('tsup'))('esbuild');
const styles = ['workspace-controls.css', 'workspace-tools.css']
  .map(name => readFileSync(resolve(root, 'labs/nebula/packages/lab/src/features/workspace', name), 'utf8')).join('\n');

test('floating tools toggle one panel above the buttons, close on Escape and hide without a source image', async () => {
  const fixture = await build({ stdin: { loader: 'tsx', resolveDir: root, contents: `
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { WorkspaceTools } from './labs/nebula/packages/lab/src/features/workspace/workspace-tools';
    import { ImageCredit } from './labs/nebula/packages/lab/src/features/workspace/image-credit';
    function App() {
      const [lens, setLens] = useState('first');
      const tools = lens === 'density' ? [] : [{ id: 'levels', label: 'Levels', tooltip: 'Levels · render against this image',
        icon: <svg viewBox="0 0 18 18"><path d="M2 15h14"/></svg>, panel: <p id="levels-body">Levels for {lens}</p> }];
      return <div className="workspace-content" style={{ position: 'fixed', inset: 0 }}>
        <div id="scene">Prepared scene</div>
        <aside id="sidebar" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 'var(--workspace-right-width)' }}>
          {['first', 'second', 'density'].map(value => <button key={value} id={'lens-' + value} onClick={() => setLens(value)}>{value}</button>)}
        </aside>
        <WorkspaceTools tools={tools} />
        <ImageCredit credit="Image credit label" />
      </div>;
    }
    createRoot(document.getElementById('fixture')).render(<App/>);
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty' } });
  const server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': request.url === '/fixture.js' ? 'text/javascript' : 'text/html' });
    response.end(request.url === '/fixture.js' ? fixture.outputFiles[0].text
      : `<style>body{margin:0}${styles}</style><div id="fixture"></div><script type="module" src="/fixture.js"></script>`);
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    const button = page.getByRole('button', { name: 'Levels', exact: true });
    await button.waitFor();
    const scene = await page.locator('#scene').elementHandle(); assert.ok(scene);
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await button.hover();
    assert.equal(await page.getByRole('tooltip').textContent(), 'Levels · render against this image');

    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Levels' });
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await button.getAttribute('aria-controls'), await dialog.getAttribute('id'));
    assert.equal(await page.locator('#levels-body').textContent(), 'Levels for first');
    const box = async (selector: string) => { const value = await page.locator(selector).boundingBox(); assert.ok(value, selector); return value; };
    const [panel, buttons, credit, sidebar] = await Promise.all(['.workspace-tool-panel', '.workspace-tool-buttons', '.workspace-image-credit', '#sidebar'].map(box));
    assert.ok(panel.x + panel.width <= sidebar.x, 'The panel must not cover the sidebar.');
    assert.ok(Math.abs(panel.x + panel.width - (buttons.x + buttons.width)) < 1, 'Panel and buttons share the sidebar-edge column.');
    assert.ok(panel.y + panel.height < buttons.y, 'The panel sits above the buttons.');
    assert.ok(buttons.y + buttons.height < credit.y, 'The buttons sit above the credit label.');
    assert.ok(panel.y >= 0 && panel.height > 400, 'The panel fills the column height.');

    await page.locator('#lens-second').click();
    assert.equal(await page.locator('#levels-body').textContent(), 'Levels for second', 'The open panel follows the lens.');
    await button.click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await button.getAttribute('aria-pressed'), 'false');

    await button.click(); await dialog.waitFor();
    await button.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0, 'One Escape closes the panel even while the tooltip is shown.');
    await button.click(); await page.locator('.workspace-tool-close').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await button.evaluate(element => element === document.activeElement), true, 'Focus returns to the tool button.');

    await button.click(); await dialog.waitFor();
    await page.locator('#lens-density').click();
    assert.equal(await page.locator('.workspace-tools').count(), 0, 'Unpainted density has no Levels tool.');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('#lens-first').click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', 'A lens switch passing through no tool keeps the panel open.');
    assert.equal(await page.locator('#levels-body').textContent(), 'Levels for first');
    assert.equal(await page.locator('.workspace-image-credit').isVisible(), true);
    assert.equal(await scene.evaluate(element => element === document.getElementById('scene')), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise<void>(done => server.close(() => done())); }
});
