// Bundled into the local preparation report; no source processing runs here.
function element(selector: string): HTMLElement {
  const value = document.querySelector(selector);
  if (!(value instanceof HTMLElement)) throw new TypeError(`Missing trial element: ${selector}`);
  return value;
}
const stage = element('#stage'), mesh = element('.mesh'), state = element('#state');
let yaw = 0, pitch = 0, last: [number, number] | null = null;
new ResizeObserver(() => stage.style.setProperty('--fit', String(stage.clientWidth / 640))).observe(stage);
function paint() {
  mesh.style.transform = `rotateY(${yaw}deg) rotateX(${pitch}deg)`;
  state.textContent = `Rotation ${yaw.toFixed(1)}° / ${pitch.toFixed(1)}° · 1,000 retained leaves`;
}
stage.onpointerdown = event => {
  last = [event.clientX, event.clientY];
  stage.setPointerCapture(event.pointerId);
};
stage.onpointermove = event => {
  if (!last) return;
  yaw += (event.clientX - last[0]) * .45;
  pitch -= (event.clientY - last[1]) * .45;
  last = [event.clientX, event.clientY];
  paint();
};
stage.onpointerup = stage.onpointercancel = () => { last = null; };
element('#reset').onclick = () => { yaw = pitch = 0; paint(); };
element('#turn').onclick = () => { yaw += 180; paint(); };
const coverage = element('#coverage');
coverage.onclick = () => {
  const on = stage.classList.toggle('coverage');
  coverage.textContent = on ? 'Show photograph' : 'Show accepted coverage';
};
