import type { Brief, Design, LayoutId, Settings } from "./types";

export const FONTS: Array<{ id: string; label: string; css: string }> = [
  { id: "unbounded", label: "Unbounded — жирный гротеск", css: "var(--f-unbounded), sans-serif" },
  { id: "montserrat", label: "Montserrat", css: "var(--f-montserrat), sans-serif" },
  { id: "playfair", label: "Playfair Display — антиква", css: "var(--f-playfair), serif" },
  { id: "cormorant", label: "Cormorant — элегантная антиква", css: "var(--f-cormorant), serif" },
  { id: "lora", label: "Lora — книжная антиква", css: "var(--f-lora), serif" },
  { id: "oswald", label: "Oswald — узкий", css: "var(--f-oswald), sans-serif" },
  { id: "rubik", label: "Rubik", css: "var(--f-rubik), sans-serif" },
  { id: "inter", label: "Inter", css: "var(--f-inter), sans-serif" },
  { id: "manrope", label: "Manrope", css: "var(--f-manrope), sans-serif" },
  { id: "caveat", label: "Caveat — рукописный", css: "var(--f-caveat), cursive" },
];

export function fontCss(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).css;
}

export interface Palette {
  id: string;
  label: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
}

// Контраст текст/фон во всех палитрах ≥ 4.5:1 (WCAG AA)
export const PALETTES: Palette[] = [
  { id: "noir", label: "Нуар", bg: "#0f0f10", surface: "#1b1b1e", text: "#f5f3ef", muted: "#b9b5ad", accent: "#ffcf5a" },
  { id: "cream", label: "Крем", bg: "#f4efe6", surface: "#e9e1d3", text: "#1d1a16", muted: "#5d554b", accent: "#c2410c" },
  { id: "forest", label: "Лес", bg: "#12261e", surface: "#1b352a", text: "#eef3ea", muted: "#b3c6b8", accent: "#c8f169" },
  { id: "blush", label: "Пудра", bg: "#f7e8e4", surface: "#efd6cf", text: "#2b1a1a", muted: "#6e5250", accent: "#b4235a" },
  { id: "ocean", label: "Океан", bg: "#0b1e33", surface: "#12304f", text: "#eef5fb", muted: "#a9c0d6", accent: "#5eead4" },
  { id: "paper", label: "Бумага", bg: "#ffffff", surface: "#f1f1f1", text: "#111111", muted: "#555555", accent: "#2f5bff" },
  { id: "lilac", label: "Лаванда", bg: "#ece8ff", surface: "#ddd6fe", text: "#1e1540", muted: "#4f4675", accent: "#7c3aed" },
  { id: "terracotta", label: "Терракота", bg: "#a4452c", surface: "#8e3a24", text: "#fff6ee", muted: "#f3d2c1", accent: "#ffd58a" },
];

export const IMAGE_STYLES: Array<{ id: string; label: string; prompt: string }> = [
  {
    id: "cinematic",
    label: "Кинематографичное фото",
    prompt:
      "cinematic editorial photography, shot on 35mm film, soft natural light, shallow depth of field, subtle film grain, rich but muted color grading",
  },
  {
    id: "editorial",
    label: "Журнальная съёмка",
    prompt:
      "high-end magazine editorial photo, clean composition, studio lighting, minimal set design, premium lifestyle aesthetic",
  },
  {
    id: "flatlay",
    label: "Флэтлей / предметка",
    prompt: "top-down flat lay product photography, soft diffused daylight, neutral textured background, carefully arranged objects",
  },
  {
    id: "3d",
    label: "3D пастель",
    prompt: "soft 3D render, clay material, pastel colors, smooth rounded shapes, gentle global illumination, minimal background",
  },
  {
    id: "illustration",
    label: "Минималистичная иллюстрация",
    prompt: "minimalist flat vector illustration, limited color palette, bold simple shapes, generous negative space, modern poster style",
  },
  {
    id: "watercolor",
    label: "Акварель",
    prompt: "delicate watercolor painting, paper texture, soft washes of color, airy and light composition",
  },
  {
    id: "collage",
    label: "Коллаж / zine",
    prompt: "mixed-media paper collage, cut-out photographs, torn paper edges, risograph texture, bold contrasting colors",
  },
  {
    id: "neon",
    label: "Неон / ночь",
    prompt: "moody night scene, neon light reflections, deep shadows, cyan and magenta highlights, atmospheric haze",
  },
  { id: "custom", label: "Свой стиль…", prompt: "" },
];

export const LAYOUTS: Array<{ id: LayoutId; label: string; hint: string }> = [
  { id: "overlay", label: "Фото на весь слайд", hint: "Картинка во весь кадр, текст поверх с затемнением" },
  { id: "split", label: "Фото сверху, текст снизу", hint: "Картинка занимает ~55% высоты" },
  { id: "frame", label: "Фото в рамке", hint: "Заголовок сверху, картинка карточкой" },
  { id: "minimal", label: "Только текст", hint: "Крупная типографика на цветном фоне" },
];

export const TONES = [
  "Дружелюбный и тёплый",
  "Экспертный, но простой",
  "Дерзкий и провокационный",
  "Вдохновляющий",
  "Ироничный",
  "Лаконичный и деловой",
];

export const GOALS = [
  "Сохранения (полезный гайд / чек-лист)",
  "Репосты (инсайт, с которым хочется поделиться)",
  "Комментарии (вопрос / мнение)",
  "Подписки (экспертность)",
  "Продажи (переход в директ / по ссылке)",
];

export const DEFAULT_BRIEF: Brief = {
  topic: "",
  audience: "",
  goal: GOALS[0],
  tone: TONES[1],
  slideCount: 8,
  language: "русский",
  extra: "",
};

export const DEFAULT_DESIGN: Design = {
  layout: "minimal",
  coverLayout: "overlay",
  ctaLayout: "overlay",
  headingFont: "playfair",
  bodyFont: "manrope",
  paletteId: "noir",
  ...pickPalette("noir"),
  overlay: 0.65,
  titleScale: 1,
  align: "left",
  uppercaseTitles: false,
  highlight: "italic",
  handle: "@your.handle",
  showCounter: true,
  showSwipe: true,
  imageStyleId: "cinematic",
  customImageStyle: "",
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  textModel: "gpt-5.5",
  imageModel: "gpt-image-2",
  imageQuality: "medium",
};

export function pickPalette(id: string) {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  return { bg: p.bg, surface: p.surface, text: p.text, muted: p.muted, accent: p.accent };
}

export function imageStylePrompt(design: Pick<Design, "imageStyleId" | "customImageStyle">): string {
  if (design.imageStyleId === "custom") return design.customImageStyle.trim();
  return IMAGE_STYLES.find((s) => s.id === design.imageStyleId)?.prompt ?? "";
}
