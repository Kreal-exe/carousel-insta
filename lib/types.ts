export type Tone = "light" | "dark";

export interface Slide {
  id: string;
  /**
   * Текст слайда с простой разметкой:
   *   # строка   — крупный заголовок (если меток нет — первый абзац становится заголовком)
   *   **слова**  — акцент
   *   ---        — тонкая линия
   *   > строка   — цитата с вертикальной линией
   *   ! строка   — плашка (внутри «! # строка» — крупно)
   */
  text: string;
  /** Фон слайда: авто (чередование) / светлый / тёмный */
  tone?: Tone;
  /** data: URL фото — слайд становится «фото на весь экран» */
  image?: string;
  /** Позиция кадра по вертикали, 0–100 */
  imageFocus?: number;
  imageStatus?: "loading" | "error";
  imageError?: string;
}

export interface Palette {
  bg1: string;
  bg2: string;
  text: string;
  muted: string;
  accent: string;
}

export interface Design {
  themeId: string;
  headingFont: string;
  bodyFont: string;
  coverFont: string;
  light: Palette;
  dark: Palette;
  /** Какой фон у первого слайда без фото; дальше — чередование */
  startTone: Tone;
  alternate: boolean;
  titleScale: number;
  bodyScale: number;
  align: "left" | "center";
  handle: string;
  showCounter: boolean;
  showArrow: boolean;
  /** Мягкая светлая дымка на фото */
  haze: boolean;
  /** 0–1: затемнение низа фото под текстом */
  overlay: number;
  coverUppercase: boolean;
  imageStyleId: string;
  customImageStyle: string;
}

export interface Settings {
  apiKey: string;
  textModel: string;
  imageModel: string;
  imageQuality: "low" | "medium" | "high";
}

export interface Project {
  slides: Slide[];
  design: Design;
  caption: string;
  topic: string;
}

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const MAX_SLIDES = 20; // лимит Instagram

/** Фон слайда: явный или по чередованию (фото-слайды в счёт не идут) */
export function toneOf(slides: Slide[], index: number, design: Design): Tone {
  const s = slides[index];
  if (s.tone) return s.tone;
  if (!design.alternate) return design.startTone;
  const pos = slides.slice(0, index).filter((x) => !x.image).length;
  const flip = design.startTone === "light" ? "dark" : "light";
  return pos % 2 === 0 ? design.startTone : flip;
}
