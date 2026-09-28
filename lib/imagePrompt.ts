type LayoutId = "overlay" | "split" | "frame" | "minimal";

const COMPOSITION: Record<LayoutId, string> = {
  overlay:
    "Vertical 4:5 composition. Main subject in the upper half; keep the lower 40% of the frame calm, uncluttered and slightly darker so large text can be placed over it.",
  split: "Horizontal-friendly composition centered in the frame, the subject fully visible, clean background.",
  frame: "Composition centered in the frame, the subject fully visible, clean uncluttered background.",
  minimal: "Clean, uncluttered composition with generous negative space.",
};

/** Итоговый промпт для GPT Image (и для копирования в ChatGPT). */
export function buildImagePrompt(scene: string, style: string, layout: LayoutId): string {
  return [
    scene.trim().replace(/\.?$/, "."),
    style && `Style: ${style}.`,
    COMPOSITION[layout],
    "Consistent look for a series of Instagram carousel slides.",
    "Absolutely no text, letters, numbers, captions, logos or watermarks in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Размер кадра под модель: gpt-image-2+ умеет произвольные размеры (кратные 16), 4:5 = 1088x1360. */
export function imageSizeFor(model: string): string {
  return /^gpt-image-(2|[3-9])/.test(model) ? "1088x1360" : "1024x1536";
}
