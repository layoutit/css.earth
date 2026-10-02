import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import {createOpacityFader} from './opacity-fader.js';
import {opacityClockFor} from './opacity-clock.js';

class Element { readonly style:Record<string,string>={opacity:'0'}; animate(){throw new Error('Web Animations must not be used');} }
class Clock {
  now=0; next=0; pending=new Map<number,(time:number)=>void>(); cancelled:number[]=[];
  requestAnimationFrame=(callback:(time:number)=>void)=>{const id=++this.next;this.pending.set(id,callback);return id;};
  cancelAnimationFrame=(id:number)=>{this.cancelled.push(id);this.pending.delete(id);};
  performance={now:()=>this.now};
  frame(milliseconds:number){this.now+=milliseconds;const callbacks=[...this.pending.values()];this.pending.clear();for(const callback of callbacks)callback(this.now);}
}

test('numeric alpha combines hover weight, reverses continuously, and can be readopted after cancellation', () => {
  const clock = new Clock();
  const element = { style: { opacity: '0', setProperty() { throw new Error('No custom-property publication'); } } } as unknown as HTMLElement;
  const fader = createOpacityFader(clock);
  fader.multiply(element, .5);
  fader.set(element, 1, 200); clock.frame(100);
  assert.equal(Number(element.style.opacity), .25);
  assert.equal(fader.current(element), .5);
  fader.set(element, 0, 200); clock.frame(100);
  assert.equal(Number(element.style.opacity), .125);
  fader.cancel(element);
  fader.set(element, 1, 200); clock.frame(100);
  assert.equal(fader.current(element), .5625);
  clock.frame(100); assert.equal(fader.current(element), 1);
  fader.set(element, 0); assert.equal(element.style.opacity, '0');
  assert.equal(clock.pending.size, 0); fader.destroy();
});

test('interpolates on wall time, retargets from the current value, and avoids Web Animations',()=>{
  const clock=new Clock(),element=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);assert.equal(element.style.opacity, '0');assert.equal(clock.pending.size, 1);
  clock.frame(50);assert.ok(Math.abs(Number(element.style.opacity) - (.5)) < 10 ** -2 / 2, `${Number(element.style.opacity)} is not close to ${.5}`);
  fader.set(element as unknown as HTMLElement,0,100);assert.equal(clock.pending.size, 1);
  clock.frame(25);assert.ok(Math.abs(Number(element.style.opacity) - (.375)) < 10 ** -2 / 2, `${Number(element.style.opacity)} is not close to ${.375}`);
  clock.frame(75);assert.equal(element.style.opacity, '0');
  fader.destroy();
});

test('disabling animation settles existing tracks and new targets without continuing their clock', () => {
  const clock = new Clock(), element = new Element(), fader = createOpacityFader(clock);
  const target = element as unknown as HTMLElement;
  fader.set(target, 1, 200); fader.multiply(target, .5, 120);
  clock.frame(50);
  fader.setAnimationEnabled(false);
  assert.equal(element.style.opacity, '0.5');
  assert.equal(fader.stats().active, 0);
  assert.equal(clock.pending.size, 0);
  fader.multiply(target, 1, 120); fader.set(target, .75, 200);
  assert.equal(element.style.opacity, '0.75');
  assert.equal(clock.pending.size, 0);
  fader.setAnimationEnabled(true);
  assert.equal(clock.pending.size, 0);
  fader.set(target, 0, 200); clock.frame(100);
  assert.equal(element.style.opacity, '0.375');
  fader.destroy();
});

test('suppression preserves a running fade and resumes its current value without restarting', () => {
  const clock = new Clock(), element = new Element(), fader = createOpacityFader(clock);
  const target = element as unknown as HTMLElement;
  fader.set(target, 1, 200); clock.frame(50);
  fader.suppress(target, true);
  assert.equal(element.style.opacity, '0');
  clock.frame(50);
  assert.equal(element.style.opacity, '0');
  assert.equal(fader.current(target), .5);
  fader.suppress(target, false);
  assert.equal(element.style.opacity, '0.5');
  clock.frame(100);
  assert.equal(element.style.opacity, '1');
  assert.equal(clock.pending.size, 0);
  fader.destroy();
});

test('same target does not restart, duration zero adopts immediately, and cancel stops work',()=>{
  const clock=new Clock(),element=new Element(),second=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);const firstFrame=1;
  fader.set(element as unknown as HTMLElement,1,100);assert.equal(clock.next, firstFrame);
  fader.set(second as unknown as HTMLElement,.4);assert.equal(second.style.opacity, '0.4');
  fader.cancel(element as unknown as HTMLElement);assert.deepEqual(clock.cancelled, [firstFrame]);assert.equal(clock.pending.size, 0);
  clock.frame(100);assert.equal(element.style.opacity, '0');fader.destroy();fader.destroy();
});

test('preserving a deadline retargets from the current value without extending the fade',()=>{
  const clock=new Clock(),element=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(40);
  fader.set(element as unknown as HTMLElement,.5,100,true);clock.frame(30);
  assert.ok(Math.abs(Number(element.style.opacity) - (.45)) < 10 ** -2 / 2, `${Number(element.style.opacity)} is not close to ${.45}`);
  clock.frame(30);assert.equal(element.style.opacity, '0.5');fader.destroy();
});

test('duration zero clears a completed fade before the element is admitted again',()=>{
  const clock=new Clock(),element=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(100);
  fader.set(element as unknown as HTMLElement,0,100);clock.frame(100);
  fader.set(element as unknown as HTMLElement,0,0);
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(50);
  assert.ok(Math.abs(Number(element.style.opacity) - (.5)) < 10 ** -2 / 2, `${Number(element.style.opacity)} is not close to ${.5}`);fader.destroy();
});

test('cancelling a pool retains unfinished fades and stops after its final active member', () => {
  const clock = new Clock(), fader = createOpacityFader(clock);
  const settled = Array.from({ length: 2048 }, () => new Element());
  for (const element of settled) fader.set(element as unknown as HTMLElement, .5);
  const fading = new Element();
  fader.set(fading as unknown as HTMLElement, 1, 100);
  for (const element of settled) fader.cancel(element as unknown as HTMLElement);
  assert.equal(clock.pending.size, 1);
  clock.frame(50);
  assert.ok(Math.abs(Number(fading.style.opacity) - (.5)) < 10 ** -2 / 2, `${Number(fading.style.opacity)} is not close to ${.5}`);
  fader.set(fading as unknown as HTMLElement, .8, 0);
  assert.equal(clock.pending.size, 0);
  assert.equal(fading.style.opacity, '0.8');
  fader.set(fading as unknown as HTMLElement, 0, 100);
  clock.frame(100);
  assert.equal(fading.style.opacity, '0');
  assert.equal(clock.pending.size, 0);
  fader.destroy();
});


test('camera commits and all fade owners flush each element only once in one RAF', () => {
  const window = new Clock(), clock = opacityClockFor(window);
  const first = createOpacityFader(window, clock), second = createOpacityFader(window, clock);
  let alpha = '0'; const writes: string[] = [];
  const element = { style: { get opacity() { return alpha; }, set opacity(value: string) { alpha = value; writes.push(value); } } } as HTMLElement;
  const star = new Element() as unknown as HTMLElement;
  first.set(element, 1, 200); second.set(star, 1, 200); writes.length = 0;
  clock.request(() => {
    first.set(element, .8, 200, true);
    first.multiply(element, .5);
    first.suppress(element, false);
  });
  assert.equal(window.pending.size, 1);
  window.frame(100);
  assert.equal(writes.length, 1);
  assert.ok(Math.abs(Number(alpha) - (.25)) < 10 ** -2 / 2, `${Number(alpha)} is not close to ${.25}`);
  assert.equal(Number(star.style.opacity), .5);
  window.frame(100);
  assert.equal(Number(alpha), .4);
  assert.equal(window.pending.size, 0);
  first.destroy(); second.destroy();
});

test('culled and suppressed fades stop ticking and reveal at their current wall time', () => {
  const window = new Clock(), fader = createOpacityFader(window), e = new Element() as unknown as HTMLElement;
  fader.set(e, 1, 200); window.frame(50);
  fader.visible(e, false);
  assert.equal(e.style.opacity, '0'); assert.equal(window.pending.size, 0);
  window.frame(100);
  fader.visible(e, true);
  assert.equal(Number(e.style.opacity), .75);
  fader.suppress(e, true); assert.equal(window.pending.size, 0);
  window.frame(100);
  fader.suppress(e, false);
  assert.equal(e.style.opacity, '1'); assert.equal(window.pending.size, 0);
  fader.destroy();
});

test('hover uses the existing 120ms ease, reverses continuously and stops at the target', () => {
  const window = new Clock(), fader = createOpacityFader(window), e = new Element() as unknown as HTMLElement;
  fader.set(e, 1); fader.multiply(e, .5); fader.multiply(e, 1, 120);
  window.frame(60); const halfway = Number(e.style.opacity);
  assert.ok(Math.abs(halfway - (.5 + .5 * .802403)) < 10 ** -5 / 2, `${halfway} is not close to ${.5 + .5 * .802403}`);
  fader.multiply(e, .5, 120);
  assert.equal(Number(e.style.opacity), halfway);
  window.frame(120); assert.equal(Number(e.style.opacity), .5);
  assert.equal(window.pending.size, 0); fader.destroy();
});

test('retiring a large set does not repeatedly advance surviving fades between animation frames', () => {
  const window = new Clock(), clock = opacityClockFor(window);
  const fader = createOpacityFader(window, clock), other = createOpacityFader(window, clock);
  let writes = 0;
  const makeElement = () => {
    let opacity = '0';
    return { style: { get opacity() { return opacity; }, set opacity(value: string) { opacity = value; writes++; } } } as HTMLElement;
  };
  const active = Array.from({ length: 512 }, makeElement), retiring = Array.from({ length: 512 }, makeElement);
  const unrelated = makeElement();
  fader.batch(() => { for (const e of [...active, ...retiring]) fader.set(e, 1, 200); other.set(unrelated, 1, 200); });
  window.frame(50); writes = 0;
  // Real wall time advances during a timer callback even though no frame has
  // been presented. Previously each removal resampled every surviving fade.
  window.performance.now = () => (window.now += .001);
  for (const e of retiring) { fader.visible(e, false); fader.cancel(e); }
  assert.equal(writes, retiring.length);
  assert.equal(active.every(e => e.style.opacity === '0.25'), true);
  assert.equal(unrelated.style.opacity, '0.25');
  assert.equal(window.pending.size, 1);
  writes = 0; window.frame(50);
  assert.equal(writes, active.length + 1);
  assert.ok(Math.abs(Number(active[0].style.opacity) - (window.now / 200)) < 10 ** -2 / 2, `${Number(active[0].style.opacity)} is not close to ${window.now / 200}`);
  window.frame(200);
  assert.equal(active.every(e => e.style.opacity === '1'), true);
  assert.equal(window.pending.size, 0);
  fader.destroy(); other.destroy();
});

test('repeated setters publish their own values immediately without advancing other entries', () => {
  const window = new Clock(), fader = createOpacityFader(window);
  const fading = new Element() as unknown as HTMLElement, changing = new Element() as unknown as HTMLElement;
  fader.set(fading, 1, 200); window.frame(50);
  window.now = 75;
  fader.set(changing, .3); fader.multiply(changing, .5);
  assert.equal(changing.style.opacity, '0.15');
  assert.equal(fading.style.opacity, '0.25');
  assert.equal(fader.current(fading), .375);
  window.frame(25);
  assert.equal(fading.style.opacity, '0.5');
  fader.destroy();
});

test('a window has one frame clock, which requests a browser frame only while an owner has work', () => {
  const window = new Clock(), clock = opacityClockFor(window);
  assert.equal(opacityClockFor(window), clock);
  assert.notEqual(opacityClockFor(new Clock()), clock);
  const ran: string[] = [];
  const first = clock.request(() => ran.push('first')), second = clock.request(() => ran.push('second'), 'input');
  assert.equal(window.pending.size, 1);
  clock.cancel(first);
  window.frame(16);
  assert.deepEqual(ran, ['second']);
  assert.equal(window.pending.size, 0);
  // An owner that cancels its last request stops the browser frame; the clock itself is never released.
  clock.cancel(clock.request(() => ran.push('cancelled')));
  assert.equal(window.pending.size, 0);
  assert.equal(window.cancelled.length, 1);
  clock.request(() => ran.push('later')); window.frame(16);
  assert.deepEqual(ran, ['second', 'later']);
  assert.ok(second > first);
});

test('an owner that asks for it gets elements hidden while their opacity is 0, and shown as soon as it rises',()=>{
  const clock=new Clock(),element=new Element(),plain=new Element(),fader=createOpacityFader(clock,undefined,{hideAtZero:true}),other=createOpacityFader(clock);
  element.style.visibility='hidden';
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(50);
  assert.ok(Math.abs(Number(element.style.opacity) - (.5)) < 10 ** -2 / 2, `${Number(element.style.opacity)} is not close to ${.5}`);assert.equal(element.style.visibility, '');
  fader.set(element as unknown as HTMLElement,0,100);clock.frame(100);
  assert.equal(element.style.opacity, '0');assert.equal(element.style.visibility, 'hidden');
  other.set(plain as unknown as HTMLElement,0);other.set(plain as unknown as HTMLElement,1);
  assert.equal(plain.style.visibility, undefined);
  fader.destroy();other.destroy();
});

test('an opacity that rounds to 0 in 8-bit color is written once, as 0', () => {
  const clock=new Clock(),element=new Element(),writes:string[]=[],fader=createOpacityFader(clock);
  const style=new Proxy(element.style,{set(target,key,value){if(key==='opacity')writes.push(String(value));target[key as string]=value;return true;}});
  const tracked={style} as unknown as HTMLElement;
  fader.set(tracked,1);clock.frame(16);writes.length=0;
  for(const faint of [.0019,.0015,.0011,.0004]){fader.set(tracked,faint);clock.frame(16);}
  assert.deepEqual(writes, ['0']);
  fader.set(tracked,.002);clock.frame(16);
  assert.deepEqual(writes, ['0','0.002']);
  fader.destroy();
});
