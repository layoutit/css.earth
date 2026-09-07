import { createNebulaLabViewer, subjects } from './viewer';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const subject = element<HTMLSelectElement>('subject');
const controls = element<HTMLFieldSetElement>('render-controls');
const axis = element<HTMLSelectElement>('axis');
const layer = element<HTMLInputElement>('layer');
const layerValue = element<HTMLOutputElement>('layer-value');
const status = element('status');
const image = element<HTMLImageElement>('source-image');
const imageStatus = element('source-image-status');
const sourceChoice = element<HTMLSelectElement>('source-choice');
const sourceLink = element<HTMLAnchorElement>('source-link');
const sourceCredit = element('source-credit');
const tabs = [element<HTMLButtonElement>('render-tab'), element<HTMLButtonElement>('source-tab')];
type Viewer = Awaited<ReturnType<typeof createNebulaLabViewer>>;
let viewer: Viewer | null = null;
let busy = false, disposed = false;
let sourceSubject: string | null = null;

for (const value of subjects) subject.add(new Option(value.name, value.id));

function selectTab(index: number) {
  tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
  element('render-panel').setAttribute('aria-hidden', String(index !== 0));
  element('source-panel').hidden = index !== 1;
  if (index === 1) showSource();
  updateCredit();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(index));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    selectTab(next); tabs[next].focus();
  });
});

function setBusy(value: boolean) {
  busy = value; subject.disabled = value; controls.disabled = value;
  element('viewer').setAttribute('aria-busy', String(value));
}
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  status.textContent = message; status.dataset.error = 'true';
  console.error(error);
}
async function run(action: () => unknown | Promise<unknown>) {
  if (!viewer || busy || disposed) return;
  try { await action(); } catch (error) { fail(error); }
}
function updateSource(id: string) {
  if (sourceSubject === id) return;
  sourceSubject = id;
  const item = subjects.find(value => value.id === id);
  if (!item) return;
  element('model-note').textContent = 'modelNote' in item && typeof item.modelNote === 'string' ? item.modelNote :
    'Depth is modeled from a source image; it is not a measured 3D reconstruction.';
  document.querySelector<HTMLInputElement>('input[name="component"][value="detail"]')!.disabled = item.hasDetail === false;
  sourceChoice.replaceChildren(...item.sourceImages.map(source => new Option(source.name, source.id)));
  element('source-choice-wrapper').hidden = item.sourceImages.length < 2;
  showSource();
  updateCredit();
}
function chosenSource() {
  return subjects.find(value => value.id === sourceSubject)?.sourceImages.find(source => source.id === sourceChoice.value);
}
function updateCredit() {
  const item = element('source-panel').hidden ? subjects.find(value => value.id === sourceSubject) : chosenSource();
  sourceLink.hidden = !item?.sourcePageUrl;
  if (item?.sourcePageUrl) sourceLink.href = item.sourcePageUrl;
  sourceCredit.textContent = item?.credit ?? '';
}
function showSource() {
  if (element('source-panel').hidden) return;
  const item = chosenSource();
  if (!item) return;
  imageStatus.textContent = 'Loading source image…';
  image.alt = item.name;
  image.src = item.sourceUrl;
  updateCredit();
}
sourceChoice.addEventListener('change', showSource);
image.addEventListener('load', () => { imageStatus.textContent = ''; });
image.addEventListener('error', () => { imageStatus.textContent = 'The local source image could not be loaded.'; });

subject.addEventListener('change', async () => {
  if (!viewer || busy) return;
  setBusy(true); status.textContent = 'Loading prepared layers…'; delete status.dataset.error;
  try { await viewer.setSubject(subject.value); }
  catch (error) { fail(error); }
  finally { if (!disposed) setBusy(false); }
});
document.querySelectorAll<HTMLInputElement>('input[name="component"]').forEach(input => {
  input.addEventListener('change', () => { if (input.checked) void run(() => viewer!.setComponent(input.value as 'all' | 'diffuse' | 'detail')); });
});
axis.addEventListener('change', () => void run(() => viewer!.setAxis(axis.value as 'auto' | 'x' | 'y' | 'z')));
layer.addEventListener('input', () => void run(() => viewer!.setLayer(Number(layer.value) < 0 ? null : Number(layer.value))));
element('all-layers').addEventListener('click', () => void run(() => viewer!.setLayer(null)));
element('reset').addEventListener('click', () => void run(() => viewer!.reset()));

setBusy(true);
try {
  if (!subjects.length) throw new Error('No prepared subjects are available.');
  const requestedSubject = new URL(location.href).searchParams.get('subject');
  const initialSubject = subjects.find(item => item.id === requestedSubject) ?? subjects[0];
  viewer = await createNebulaLabViewer({ host: element('viewer'), subjectId: initialSubject.id, onState(state) {
    if (disposed) return;
    subject.value = state.subjectId;
    updateSource(state.subjectId);
    axis.value = state.axis;
    document.querySelectorAll<HTMLInputElement>('input[name="component"]').forEach(input => { input.checked = input.value === state.component; });
    layer.max = String(Math.max(-1, state.layerCount - 1));
    layer.value = String(state.layer ?? -1);
    layer.disabled = state.layerCount === 0;
    const text = state.layer === null ? 'All layers' : `Layer ${state.layer + 1} / ${state.layerCount}`;
    layerValue.textContent = text; layer.setAttribute('aria-valuetext', text);
    status.textContent = state.status ?? `${state.layerCount} layers`;
    delete status.dataset.error;
    if (state.error) fail(state.error);
  } });
  if (disposed) viewer.destroy(); else setBusy(false);
} catch (error) { fail(error); }

function destroy() { if (!disposed) { disposed = true; viewer?.destroy(); } }
window.addEventListener('pagehide', destroy, { once: true });
if (import.meta.hot) import.meta.hot.dispose(destroy);
