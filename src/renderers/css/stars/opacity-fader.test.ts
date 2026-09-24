import {expect,test} from 'vitest';
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
  expect(Number(element.style.opacity)).toBe(.25);
  expect(fader.current(element)).toBe(.5);
  fader.set(element, 0, 200); clock.frame(100);
  expect(Number(element.style.opacity)).toBe(.125);
  fader.cancel(element);
  fader.set(element, 1, 200); clock.frame(100);
  expect(fader.current(element)).toBe(.5625);
  clock.frame(100); expect(fader.current(element)).toBe(1);
  fader.set(element, 0); expect(element.style.opacity).toBe('0');
  expect(clock.pending.size).toBe(0); fader.destroy();
});

test('interpolates on wall time, retargets from the current value, and avoids Web Animations',()=>{
  const clock=new Clock(),element=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);expect(element.style.opacity).toBe('0');expect(clock.pending.size).toBe(1);
  clock.frame(50);expect(Number(element.style.opacity)).toBeCloseTo(.5);
  fader.set(element as unknown as HTMLElement,0,100);expect(clock.pending.size).toBe(1);
  clock.frame(25);expect(Number(element.style.opacity)).toBeCloseTo(.375);
  clock.frame(75);expect(element.style.opacity).toBe('0');
  fader.destroy();
});

test('disabling animation settles existing tracks and new targets without continuing their clock', () => {
  const clock = new Clock(), element = new Element(), fader = createOpacityFader(clock);
  const target = element as unknown as HTMLElement;
  fader.set(target, 1, 200); fader.multiply(target, .5, 120);
  clock.frame(50);
  fader.setAnimationEnabled(false);
  expect(element.style.opacity).toBe('0.5');
  expect(fader.stats().active).toBe(0);
  expect(clock.pending.size).toBe(0);
  fader.multiply(target, 1, 120); fader.set(target, .75, 200);
  expect(element.style.opacity).toBe('0.75');
  expect(clock.pending.size).toBe(0);
  fader.setAnimationEnabled(true);
  expect(clock.pending.size).toBe(0);
  fader.set(target, 0, 200); clock.frame(100);
  expect(element.style.opacity).toBe('0.375');
  fader.destroy();
});

test('suppression preserves a running fade and resumes its current value without restarting', () => {
  const clock = new Clock(), element = new Element(), fader = createOpacityFader(clock);
  const target = element as unknown as HTMLElement;
  fader.set(target, 1, 200); clock.frame(50);
  fader.suppress(target, true);
  expect(element.style.opacity).toBe('0');
  clock.frame(50);
  expect(element.style.opacity).toBe('0');
  expect(fader.current(target)).toBe(.5);
  fader.suppress(target, false);
  expect(element.style.opacity).toBe('0.5');
  clock.frame(100);
  expect(element.style.opacity).toBe('1');
  expect(clock.pending.size).toBe(0);
  fader.destroy();
});

test('same target does not restart, duration zero adopts immediately, and cancel stops work',()=>{
  const clock=new Clock(),element=new Element(),second=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);const firstFrame=1;
  fader.set(element as unknown as HTMLElement,1,100);expect(clock.next).toBe(firstFrame);
  fader.set(second as unknown as HTMLElement,.4);expect(second.style.opacity).toBe('0.4');
  fader.cancel(element as unknown as HTMLElement);expect(clock.cancelled).toEqual([firstFrame]);expect(clock.pending.size).toBe(0);
  clock.frame(100);expect(element.style.opacity).toBe('0');fader.destroy();fader.destroy();
});

test('preserving a deadline retargets from the current value without extending the fade',()=>{
  const clock=new Clock(),element=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(40);
  fader.set(element as unknown as HTMLElement,.5,100,true);clock.frame(30);
  expect(Number(element.style.opacity)).toBeCloseTo(.45);
  clock.frame(30);expect(element.style.opacity).toBe('0.5');fader.destroy();
});

test('duration zero clears a completed fade before the element is admitted again',()=>{
  const clock=new Clock(),element=new Element(),fader=createOpacityFader(clock);
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(100);
  fader.set(element as unknown as HTMLElement,0,100);clock.frame(100);
  fader.set(element as unknown as HTMLElement,0,0);
  fader.set(element as unknown as HTMLElement,1,100);clock.frame(50);
  expect(Number(element.style.opacity)).toBeCloseTo(.5);fader.destroy();
});

test('cancelling a pool retains unfinished fades and stops after its final active member', () => {
  const clock = new Clock(), fader = createOpacityFader(clock);
  const settled = Array.from({ length: 2048 }, () => new Element());
  for (const element of settled) fader.set(element as unknown as HTMLElement, .5);
  const fading = new Element();
  fader.set(fading as unknown as HTMLElement, 1, 100);
  for (const element of settled) fader.cancel(element as unknown as HTMLElement);
  expect(clock.pending.size).toBe(1);
  clock.frame(50);
  expect(Number(fading.style.opacity)).toBeCloseTo(.5);
  fader.set(fading as unknown as HTMLElement, .8, 0);
  expect(clock.pending.size).toBe(0);
  expect(fading.style.opacity).toBe('0.8');
  fader.set(fading as unknown as HTMLElement, 0, 100);
  clock.frame(100);
  expect(fading.style.opacity).toBe('0');
  expect(clock.pending.size).toBe(0);
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
  expect(window.pending.size).toBe(1);
  window.frame(100);
  expect(writes).toHaveLength(1);
  expect(Number(alpha)).toBeCloseTo(.25);
  expect(Number(star.style.opacity)).toBe(.5);
  window.frame(100);
  expect(Number(alpha)).toBe(.4);
  expect(window.pending.size).toBe(0);
  first.destroy(); second.destroy();
});

test('culled and suppressed fades stop ticking and reveal at their current wall time', () => {
  const window = new Clock(), fader = createOpacityFader(window), e = new Element() as unknown as HTMLElement;
  fader.set(e, 1, 200); window.frame(50);
  fader.visible(e, false);
  expect(e.style.opacity).toBe('0'); expect(window.pending.size).toBe(0);
  window.frame(100);
  fader.visible(e, true);
  expect(Number(e.style.opacity)).toBe(.75);
  fader.suppress(e, true); expect(window.pending.size).toBe(0);
  window.frame(100);
  fader.suppress(e, false);
  expect(e.style.opacity).toBe('1'); expect(window.pending.size).toBe(0);
  fader.destroy();
});

test('hover uses the existing 120ms ease, reverses continuously and stops at the target', () => {
  const window = new Clock(), fader = createOpacityFader(window), e = new Element() as unknown as HTMLElement;
  fader.set(e, 1); fader.multiply(e, .5); fader.multiply(e, 1, 120);
  window.frame(60); const halfway = Number(e.style.opacity);
  expect(halfway).toBeCloseTo(.5 + .5 * .802403, 5);
  fader.multiply(e, .5, 120);
  expect(Number(e.style.opacity)).toBe(halfway);
  window.frame(120); expect(Number(e.style.opacity)).toBe(.5);
  expect(window.pending.size).toBe(0); fader.destroy();
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
  expect(writes).toBe(retiring.length);
  expect(active.every(e => e.style.opacity === '0.25')).toBe(true);
  expect(unrelated.style.opacity).toBe('0.25');
  expect(window.pending.size).toBe(1);
  writes = 0; window.frame(50);
  expect(writes).toBe(active.length + 1);
  expect(Number(active[0].style.opacity)).toBeCloseTo(window.now / 200);
  window.frame(200);
  expect(active.every(e => e.style.opacity === '1')).toBe(true);
  expect(window.pending.size).toBe(0);
  fader.destroy(); other.destroy();
});

test('repeated setters publish their own values immediately without advancing other entries', () => {
  const window = new Clock(), fader = createOpacityFader(window);
  const fading = new Element() as unknown as HTMLElement, changing = new Element() as unknown as HTMLElement;
  fader.set(fading, 1, 200); window.frame(50);
  window.now = 75;
  fader.set(changing, .3); fader.multiply(changing, .5);
  expect(changing.style.opacity).toBe('0.15');
  expect(fading.style.opacity).toBe('0.25');
  expect(fader.current(fading)).toBe(.375);
  window.frame(25);
  expect(fading.style.opacity).toBe('0.5');
  fader.destroy();
});

test('a window has one frame clock, which requests a browser frame only while an owner has work', () => {
  const window = new Clock(), clock = opacityClockFor(window);
  expect(opacityClockFor(window)).toBe(clock);
  expect(opacityClockFor(new Clock())).not.toBe(clock);
  const ran: string[] = [];
  const first = clock.request(() => ran.push('first')), second = clock.request(() => ran.push('second'), 'input');
  expect(window.pending.size).toBe(1);
  clock.cancel(first);
  window.frame(16);
  expect(ran).toEqual(['second']);
  expect(window.pending.size).toBe(0);
  // An owner that cancels its last request stops the browser frame; the clock itself is never released.
  clock.cancel(clock.request(() => ran.push('cancelled')));
  expect(window.pending.size).toBe(0);
  expect(window.cancelled).toHaveLength(1);
  clock.request(() => ran.push('later')); window.frame(16);
  expect(ran).toEqual(['second', 'later']);
  expect(second).toBeGreaterThan(first);
});
