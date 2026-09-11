import type { Browser, Page } from 'playwright';
import type { ObjectRuntimeDiagnostics } from '../env.d.ts';
import type { SceneDiagnostics } from '../scene-router.mts';
import type { WorldContextDiagnostics } from '../application-world-context.mts';

/** This function is serialized by Playwright: every runtime dependency is local. */
export function installBrowserObservations() {
  const observations = {
    required<T>(value: T, label: string): NonNullable<T> {
      if (value === null || value === undefined) throw new Error(`Missing browser observation: ${label}`);
      return value;
    },
    record(value: unknown, label: string): Record<string, unknown> {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid object observation: ${label}`);
      return value as Record<string, unknown>;
    },
    number(value: unknown, label: string): number {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid numeric observation: ${label}`);
      return value;
    },
    scene(): SceneDiagnostics {
      const value = window.__cssEarth;
      if (!value) throw new Error('Scene diagnostics are not published.');
      return value;
    },
    object(id?: string): ObjectRuntimeDiagnostics {
      const value = window.__cssEarth?.object(id);
      if (!value) throw new Error(`Object diagnostics are not published: ${id ?? 'active'}`);
      return value;
    },
    universe(): WorldContextDiagnostics {
      const value = window.__cssEarthUniverse;
      if (!value) throw new Error('World diagnostics are not published.');
      return value;
    },
    detailsElement(element: Element | null | undefined): HTMLDetailsElement {
      if (!(element instanceof HTMLDetailsElement)) throw new Error('Expected an observed details element.');
      return element;
    },
    htmlElement(element: Element | null | undefined): HTMLElement {
      if (!(element instanceof HTMLElement)) throw new Error('Expected an observed HTML element.');
      return element;
    },
    html(selector: string, root: ParentNode = document): HTMLElement {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing HTML observation: ${selector}`);
      return element;
    },
    element(selector: string, root: ParentNode = document): Element {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing element observation: ${selector}`);
      return element;
    },
    button(selector: string, root: ParentNode = document): HTMLButtonElement {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button observation: ${selector}`);
      return element;
    },
    input(selector: string, root: ParentNode = document): HTMLInputElement {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLInputElement)) throw new Error(`Missing input observation: ${selector}`);
      return element;
    },
    physicalCamera(id?: string) {
      const camera = observations.object(id).camera.state();
      const { focal, principalOffset, distanceKilometers } = camera;
      if (typeof focal !== 'number' || !Number.isFinite(focal) || !principalOffset ||
          typeof distanceKilometers !== 'number' || !Number.isFinite(distanceKilometers)) {
        throw new Error(`Physical camera observation is unavailable: ${id ?? 'active'}`);
      }
      return { ...camera, focal, principalOffset, distanceKilometers };
    },
  };
  window.__cssearthTest = observations;
  return observations;
}

declare global { interface Window { __cssearthTest: ReturnType<typeof installBrowserObservations>; } }

export async function createTestPage(owner: Pick<Browser, 'newPage'>,
  options?: Parameters<Browser['newPage']>[0]): Promise<Page> {
  const page = await owner.newPage(options);
  try {
    await page.addInitScript(installBrowserObservations);
    await page.evaluate(installBrowserObservations);
    return page;
  } catch (error) { await page.close(); throw error; }
}
