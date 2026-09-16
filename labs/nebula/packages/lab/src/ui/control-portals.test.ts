import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = process.cwd();
const packageRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(packageRequire.resolve('tsup'))('esbuild');

function assertRootOwner(path: string, source: string) {
  if (path !== 'shell/entry.tsx') assert.doesNotMatch(source, /from\s*['"]react-dom\/client['"]|\bcreateRoot\s*\(/, `${path} creates another React root`);
}
test('only the application entrypoint may create a React root', async () => {
  const directory = resolve(root, 'labs/nebula/packages/lab/src');
  for (const path of await readdir(directory, { recursive: true })) {
    if (!/\.tsx?$/.test(path) || path.endsWith('.test.ts')) continue;
    assertRootOwner(path, await readFile(resolve(directory, path), 'utf8'));
  }
  assert.throws(() => assertRootOwner('components/regression.tsx', "import { createRoot } from 'react-dom/client';"), /another React root/);
});

test('control portals inherit app context, preserve component state and detach through the same root', async () => {
  const fixture = await build({ stdin: { loader: 'tsx', resolveDir: root, contents: `
    import { createContext, useContext, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { createControlPortals, ControlPortalContents } from './labs/nebula/packages/lab/src/ui/control-portals';
    const controls = createControlPortals(), Context = createContext('missing app context');
    let port;
    function Counter({ label }) { const context = useContext(Context), [count, setCount] = useState(0);
      return <button id="counter" onClick={() => setCount(count + 1)}>{context}:{label}:{count}</button>; }
    function App() { const [context, setContext] = useState('app');
      return <Context.Provider value={context}><div id="host" />
        <button id="mount" onClick={() => { port = controls.mount(document.getElementById('host')); port.render(<Counter label="first" />); }}>Mount</button>
        <button id="update" onClick={() => port.render(<Counter label="second" />)}>Update</button>
        <button id="context" onClick={() => setContext('updated app')}>Context</button>
        <button id="remove" onClick={() => port.unmount()}>Remove</button>
        <ControlPortalContents controls={controls} /></Context.Provider>; }
    createRoot(document.getElementById('fixture')).render(<App />);
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic' });
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
    await page.goto(`http://127.0.0.1:${address.port}`); await page.locator('#mount').click();
    assert.equal(await page.locator('#counter').textContent(), 'app:first:0');
    const node = await page.locator('#counter').elementHandle(); assert.ok(node);
    await page.locator('#counter').click(); await page.locator('#update').click(); await page.locator('#context').click();
    assert.equal(await page.locator('#counter').textContent(), 'updated app:second:1');
    assert.equal(await node.evaluate(element => element === document.querySelector('#counter')), true);
    await page.locator('#remove').click(); assert.equal(await page.locator('#counter').count(), 0);
    assert.equal(await node.evaluate(element => element.isConnected), false);
    await page.locator('#mount').click(); assert.equal(await page.locator('#counter').textContent(), 'updated app:first:0');
    assert.deepEqual(errors, []); await node.dispose();
  } finally { await browser.close(); await new Promise<void>(done => server.close(() => done())); }
});
