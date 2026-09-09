import {expect,test} from 'vitest';
import {createOpacityFader} from './opacity-fader.js';

class Element { readonly style:Record<string,string>={opacity:'0'}; animate(){throw new Error('Web Animations must not be used');} }
class Clock {
  now=0; next=0; pending=new Map<number,(time:number)=>void>(); cancelled:number[]=[];
  requestAnimationFrame=(callback:(time:number)=>void)=>{const id=++this.next;this.pending.set(id,callback);return id;};
  cancelAnimationFrame=(id:number)=>{this.cancelled.push(id);this.pending.delete(id);};
  performance={now:()=>this.now};
  frame(milliseconds:number){this.now+=milliseconds;const callbacks=[...this.pending.values()];this.pending.clear();for(const callback of callbacks)callback(this.now);}
}

test('direct alpha preserves CSS hover policy, reverses continuously, and can be readopted after cancellation', () => {
  const clock = new Clock();
  const element = { style: { opacity: '0', setProperty() { throw new Error('No custom-property publication'); } } } as unknown as HTMLElement;
  const fader = createOpacityFader(clock, 'var(--hover-opacity)');
  fader.set(element, 1, 200); clock.frame(100);
  expect(element.style.opacity).toBe('calc(0.5 * var(--hover-opacity))');
  expect(fader.current(element)).toBe(.5);
  fader.set(element, 0, 200); clock.frame(100);
  expect(element.style.opacity).toBe('calc(0.25 * var(--hover-opacity))');
  fader.cancel(element);
  fader.set(element, 1, 200); clock.frame(100);
  expect(fader.current(element)).toBe(.625);
  clock.frame(100); expect(fader.current(element)).toBe(1);
  fader.set(element, 0); expect(element.style.opacity).toBe('calc(0 * var(--hover-opacity))');
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
