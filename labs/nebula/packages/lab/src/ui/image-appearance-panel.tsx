import type { ReactNode } from "react";
import { InfoTip } from "./info-tip";
import "./image-appearance-panel.css";

export type ImageAppearanceToggle =
  | { checked: boolean; onChange(checked: boolean): void; reason?: never }
  | { checked?: boolean; reason: string; onChange?: never };
export function ImageAppearanceCheckbox({
  label,
  id,
  control,
}: {
  label: string;
  id?: string;
  control: ImageAppearanceToggle;
}) {
  return (
    <InfoTip
      content={
        control.reason ??
        (label === "Stars"
          ? "Show the independently prepared catalogue stars."
          : "Show the original photograph in its saved registration.")
      }
    >
      <label className="observation-check">
        <input
          id={id}
          type="checkbox"
          checked={control.checked ?? false}
          aria-disabled={Boolean(control.reason)}
          onChange={(event) => {
            if (!control.reason) control.onChange?.(event.target.checked);
          }}
        />
        {label}
      </label>
    </InfoTip>
  );
}

/** Shared order and capability disclosure; host callbacks retain their original scientific meaning. */
export function ImageAppearancePanel({
  image,
  material,
  stars,
  original,
}: {
  image: ReactNode;
  material:
    | {
        mode: "neutral" | "textured";
        onChange(mode: "neutral" | "textured"): void;
        reason?: never;
      }
    | { mode?: "neutral" | "textured"; reason: string; onChange?: never };
  stars: ReactNode;
  original: ReactNode;
}) {
  return (
    <section className="image-appearance-panel" aria-label="Image appearance">
      {image}
      <div
        className="image-appearance-material"
        role="group"
        aria-label="Cloud material"
      >
        {(["neutral", "textured"] as const).map((mode) => (
          <InfoTip
            key={mode}
            content={
              material.reason ??
              (mode === "neutral"
                ? "Inspect the prepared cloud without image colors."
                : "Show the selected image colors on the same prepared cloud.")
            }
          >
            <button
              type="button"
              aria-pressed={material.mode === mode}
              aria-disabled={Boolean(material.reason)}
              onClick={() => {
                if (!material.reason) material.onChange?.(mode);
              }}
            >
              {mode === "neutral" ? "Neutral" : "Textured"}
            </button>
          </InfoTip>
        ))}
      </div>
      <div className="image-appearance-toggles">
        {stars}
        {original}
      </div>
    </section>
  );
}
