import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const packageRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(packageRequire.resolve('tsup'))('esbuild');

test('workspace portals keep navigation visibility, selected credit and accessible help in one retained scene', async () => {
  const fixture = await build({ stdin: { loader: 'tsx', resolveDir: root, contents: `
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { WorkspaceSections } from './labs/nebula/packages/lab/src/pages/reconstruction/workspace-sections';
    import { CameraModelPanel } from './labs/nebula/packages/lab/src/ui/camera-model-panel';
    import { ImageCredit } from './labs/nebula/packages/lab/src/features/workspace/image-credit';
    import { WorkspaceImagePicker } from './labs/nebula/packages/lab/src/features/workspace/workspace-image-picker';
    function App() {
      const [reconstruction, setReconstruction] = useState(false), [credit, setCredit] = useState('First image credit'), [mode, setMode] = useState('compiler'), [cameraCalls, setCameraCalls] = useState(0);
      return <><button id="navigate" onClick={() => setReconstruction(!reconstruction)}>Navigate</button>
        <button id="image" onClick={() => setCredit('Second image credit')}>Change image</button>
        <div className="workspace-content"><div id="scene">Prepared scene</div>
          <CameraModelPanel camera={{ reset: { onActivate: () => setCameraCalls(value => value + 1) } }} modelReason="Fixed prepared density"/>
          <output id="camera-calls">{cameraCalls}</output>
          <aside hidden={!reconstruction}><div id="inference-image-picker"/><div id="process">Processing</div>
            <WorkspaceSections visible={reconstruction} active={mode} capabilities={{ compiler: true }} onChange={setMode}/>
            <WorkspaceImagePicker><label htmlFor="picker">Image</label><select id="picker"><option>Saved image</option></select></WorkspaceImagePicker>
            <ImageCredit active={reconstruction} credit={credit}/>
          </aside>
          <ImageCredit active={!reconstruction} credit="Alignment image credit"/>
        </div></>;
    }
    createRoot(document.getElementById('fixture')).render(<App/>);
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty' } });
  const server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': request.url === '/fixture.js' ? 'text/javascript' : 'text/html' });
    response.end(request.url === '/fixture.js' ? fixture.outputFiles[0].text : '<div id="fixture"></div><script type="module" src="/fixture.js"></script>');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.locator('.workspace-image-credit').waitFor();
    const scene = await page.locator('#scene').elementHandle(); assert.ok(scene);
    assert.equal(await page.locator('.workspace-section-navigation').count(), 0);
    assert.equal(await page.locator('.workspace-image-credit').textContent(), 'Alignment image credit');
    await page.locator('#navigate').click();
    await page.locator('.workspace-section-navigation').waitFor();
    assert.equal(await page.locator('.workspace-section-navigation').count(), 1);
    assert.equal(await page.locator('[data-workspace-section]').count(), 7);
    assert.equal(await page.locator('.workspace-section-navigation button').count(), 7);
    assert.equal(await page.locator('.workspace-image-credit').count(), 1);
    assert.equal(await page.locator('.workspace-image-credit').textContent(), 'First image credit');
    assert.equal(await page.locator('#picker').evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById('process')!) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    assert.equal(await page.locator('[data-workspace-section="kinematics"]').isDisabled(), true);
    const info = page.getByRole('button', { name: 'Velocity', exact: true });
    assert.equal(await info.getAttribute('aria-disabled'), 'true'); await info.focus();
    assert.match(await page.getByRole('tooltip').textContent() ?? '', /observed line velocities.*not configured/);
    assert.equal(await page.getByRole('tooltip').evaluate(element => element.matches(':popover-open')), true, 'Tooltips must escape clipped sidebars through the browser top layer.');
    await info.press('Escape'); assert.equal(await page.getByRole('tooltip').count(), 0);
    await info.press('Enter');
    assert.equal(await page.locator('[data-workspace-section=compiler]').getAttribute('aria-pressed'), 'true');
    assert.equal(await info.getAttribute('aria-pressed'), 'false');
    await page.locator('#image').click();
    assert.equal(await page.locator('.workspace-image-credit').textContent(), 'Second image credit');
    assert.equal(await page.locator('.workspace-image-credit a').count(), 0);
    await page.locator('[data-camera-action=reset]').click();
    assert.equal(await page.locator('#camera-calls').textContent(), '1');
    await page.locator('[data-camera-action=orbit]').focus();
    assert.match(await page.getByRole('tooltip').textContent() ?? '', /not available/);
    await page.locator('[data-camera-action=orbit]').press('Enter');
    assert.equal(await page.locator('#camera-calls').textContent(), '1');
    await page.locator('[data-camera-action=orbit]').press('Escape');
    assert.equal(await scene.evaluate(element => element === document.getElementById('scene')), true);
    await page.locator('#navigate').click();
    assert.equal(await page.locator('.workspace-section-navigation').count(), 0);
    assert.equal(await page.locator('.workspace-image-credit').count(), 1);
    assert.equal(await page.locator('.workspace-image-credit').textContent(), 'Alignment image credit');
    assert.equal(await page.locator('.workspace-content').evaluate(element => element.getAttribute('style')?.includes('--workspace-navigation-height') ?? false), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise<void>(done => server.close(() => done())); }
});
