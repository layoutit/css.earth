import type { VolumeCameraPublication } from '../volume/types.js';

/** What an overlay's builder hands its owner: its root, built off the page, how to place it for a publication, and what
 * it does once the camera rests. */
export interface CloudOverlayLayer { readonly root: HTMLElement; place(publication: VolumeCameraPublication): void; atRest?(): void }

/** A style written only when its value changes: a still camera publishes the same values every frame. */
export function retainedStyle(element: HTMLElement) {
  let transform = '', opacity = '';
  return {
    transform(value: string) { if (value !== transform) { transform = value; element.style.transform = value; } },
    opacity(value: string) { if (value !== opacity) { opacity = value; element.style.opacity = value; } },
  };
}
