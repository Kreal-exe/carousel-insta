import type { Design, Palette, Settings } from "./types";

export const FONTS: Array<{ id: string; label: string; css: string }> = [
  { id: "tenor", label: "Tenor Sans — элегантный", css: "var(--f-tenor), sans-serif" },
  { id: "forum", label: "Forum — классика", css: "var(--f-forum), serif" },
  { id: "cormorant", label: "Cormorant — антиква", css: "var(--f-cormorant), serif" },
  { id: "playfair", label: "Playfair Display", css: "var(--f-playfair), serif" },
  { id: "lora", label: "Lora", css: "var(--f-lora), serif" },
  { id: "montserrat", label: "Montserrat", css: "var(--f-montserrat), sans-serif" },
  { id: "manrope", label: "Manrope", css: "var(--f-manrope), sans-serif" },
  { id: "inter", label: "Inter", css: "var(--f-inter), sans-serif" },
  { id: "unbounded", label: "Unbounded — широкий", css: "var(--f-unbounded), sans-serif" },
  { id: "oswald", label: "Oswald — узкий", css: "var(--f-oswald), sans-serif" },
];

export function fontCss(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).css;
}

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

const pal = (bg1: string, bg2: string, text: string, muted: string, accent: string): Palette => ({ bg1, bg2, text, muted, accent });

// Темы: пары «светлый / тёмный» фон + шрифты. Контраст текста ≥ 4.5:1.
export const THEMES: Array<{ id: string; label: string; design: Partial<Design> }> = [
  {
    id: "mocha",
    label: "Крем и шоколад",
    design: {
      headingFont: "tenor", bodyFont: "montserrat", coverFont: "montserrat",
      light: pal("#f8f4ee", "#e8dbc5", "#2a1f17", "#5b4b3e", "#8a6a3a"),
      dark: pal("#3b2a20", "#211812", "#f3e9dc", "#c9b8a4", "#d9b98f"),
    },
  },
  {
    id: "graphite",
    label: "Графит",
    design: {
      headingFont: "tenor", bodyFont: "inter", coverFont: "inter",
      light: pal("#f5f5f3", "#e4e4e0", "#1b1b1b", "#555555", "#6b6b6b"),
      dark: pal("#2b2b2d", "#141415", "#f2f2f0", "#b5b5b5", "#e0e0e0"),
    },
  },
  {
    id: "olive",
    label: "Олива",
    design: {
      headingFont: "forum", bodyFont: "montserrat", coverFont: "montserrat",
      light: pal("#f4f2e9", "#e3e0cd", "#23261b", "#555a45", "#6e7a3f"),
      dark: pal("#2f3325", "#1a1d14", "#eef0e4", "#bfc3ad", "#c9d38f"),
    },
  },
  {
    id: "powder",
    label: "Пудра",
    design: {
      headingFont: "cormorant", bodyFont: "montserrat", coverFont: "montserrat",
      light: pal("#fbf3f1", "#efdcd7", "#2d1b1b", "#6b5250", "#a4515f"),
      dark: pal("#4a2c31", "#2a171b", "#f8ebe8", "#d5bcb8", "#f0b8b8"),
    },
  },
  {
    id: "ocean",
    label: "Океан",
    design: {
      headingFont: "tenor", bodyFont: "manrope", coverFont: "manrope",
      light: pal("#f1f5f8", "#dde7ee", "#14222e", "#4a5b68", "#2d6b8f"),
      dark: pal("#1b3142", "#0e1b25", "#eaf2f7", "#a9bfcf", "#8fd0e8"),
    },
  },
  {
    id: "contrast",
    label: "Чёрно-белый",
    design: {
      headingFont: "playfair", bodyFont: "inter", coverFont: "inter",
      light: pal("#ffffff", "#f0f0f0", "#111111", "#4d4d4d", "#111111"),
      dark: pal("#161616", "#000000", "#ffffff", "#b3b3b3", "#ffffff"),
    },
  },
];

export const DEFAULT_DESIGN: Design = {
  themeId: "mocha",
  headingFont: "tenor",
  bodyFont: "montserrat",
  coverFont: "montserrat",
  light: THEMES[0].design.light!,
  dark: THEMES[0].design.dark!,
  startTone: "light",
  alternate: true,
  titleScale: 1,
  bodyScale: 1,
  align: "left",
  handle: "@sveta_dubinskaya_master",
  showCounter: true,
  showArrow: true,
  haze: true,
  overlay: 0.7,
  coverUppercase: true,
  imageStyleId: "editorial",
  customImageStyle: "",
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  textModel: "gpt-5.5",
  imageModel: "gpt-image-2",
  imageQuality: "medium",
};

export function imageStylePrompt(design: Pick<Design, "imageStyleId" | "customImageStyle">): string {
  if (design.imageStyleId === "custom") return design.customImageStyle.trim();
  return IMAGE_STYLES.find((s) => s.id === design.imageStyleId)?.prompt ?? "";
}
