// Benchmark enhancement: identical scene and angle mapping, ordinary pointer
// events publishing the two CSS values once per animation frame.
const area = document.querySelector<HTMLElement>('.controls');
const box = document.querySelector<HTMLElement>('.resizable');
if (!area || !box) throw new Error('The retained native input is missing.');
const body = document.body;
const current = getComputedStyle(box);
let width = Number.parseFloat(current.width);
let height = Number.parseFloat(current.height);
if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Native dimensions are invalid.');
const publish = () => {
  body.style.setProperty('--box-width', String(width));
  body.style.setProperty('--box-height', String(height));
};
publish();
body.classList.add('js-input');
document.documentElement.dataset.inputReady = 'true';
let drag: { id: number; x: number; y: number; width: number; height: number } | null = null;
let pending = 0;
const flush = () => { pending = 0; publish(); };
area.addEventListener('pointerdown', event => {
  if (event.button !== 0 || drag) return;
  event.preventDefault();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, width, height };
  area.setPointerCapture(event.pointerId);
});
area.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  width = Math.max(900, Math.min(1500, drag.width + Math.round(event.clientX - drag.x)));
  height = Math.max(900, Math.min(1500, drag.height + Math.round(event.clientY - drag.y)));
  if (!pending) pending = requestAnimationFrame(flush);
});
const end = (event: PointerEvent) => {
  if (!drag || drag.id !== event.pointerId) return;
  if (pending) cancelAnimationFrame(pending);
  flush();
  // Leave the native element with the enhanced endpoint, too.
  box.style.width = `${width}px`; box.style.height = `${height}px`;
  drag = null;
};
area.addEventListener('pointerup', end);
area.addEventListener('pointercancel', end);
