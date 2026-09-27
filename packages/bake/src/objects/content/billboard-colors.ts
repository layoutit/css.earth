// The billboard colour of each lens control: plain imports, so the full preparer and the observation refresh share one computation.
import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";

/** The mean colour of each lens control's surface image, the colour a sub-pixel body shows; an interior view shows its default lens. */
export async function lensBillboardColors(
  controls: readonly Record<string, unknown>[],
  defaultLens: string,
  publicDirectory: string,
): Promise<Map<string, string>> {
  const sharp = (await import("sharp")).default;
  const defaultControl = controls.find((control) => control.id === defaultLens);
  const colors = new Map<string, string>();
  for (const control of controls) {
    const controlId = typeof control.id === "string" ? control.id : "";
    const candidate = control.view === "interior"
      ? defaultControl?.surface2xUrl
      : control.surface2xUrl;
    if (typeof candidate !== "string") continue;
    try {
      const path = resolve(publicDirectory, basename(new URL(candidate, "https://cssearth.invalid").pathname));
      // sharp's missing-file error does not carry Node's ENOENT code.
      // Keep this optional probe's existing absence policy explicit.
      await access(path);
      const { channels } = await sharp(path)
        .removeAlpha()
        .stats();
      // A one-channel grayscale map displays its value in all three channels.
      const rgb = channels.length === 1 ? [channels[0], channels[0], channels[0]] : channels.slice(0, 3);
      colors.set(controlId, `#${rgb.map(({ mean }) => Math.round(mean).toString(16).padStart(2, "0")).join("")}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return colors;
}
