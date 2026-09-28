export type SlideKind = "cover" | "content" | "cta";

export type LayoutId = "overlay" | "split" | "frame" | "minimal";

export type ImageStatus = "idle" | "loading" | "done" | "error";

export interface Slide {
  id: string;
  kind: SlideKind;
  /** Маленькая надпись над заголовком (номер шага, рубрика) */
  eyebrow: string;
  /** Заголовок. **слово** — выделение акцентным цветом */
  title: string;
  body: string;
  /** Промпт для генерации картинки (на английском) */
  imagePrompt: string;
  /** data: URL изображения */
  image?: string;
  imageStatus: ImageStatus;
  imageError?: string;
  /** Переопределение макета для конкретного слайда */
  layout?: LayoutId;
  /** Позиция кадра по вертикали, 0–100 (object-position) */
  imageFocus?: number;
}

export interface Design {
  layout: LayoutId;
  coverLayout: LayoutId;
  ctaLayout: LayoutId;
  headingFont: string;
  bodyFont: string;
  paletteId: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  /** 0–1: насколько затемнять фото под текстом */
  overlay: number;
  titleScale: number;
  align: "left" | "center";
  uppercaseTitles: boolean;
  /** Как выделять **слова** в заголовках */
  highlight: "color" | "italic" | "marker";
  handle: string;
  showCounter: boolean;
  showSwipe: boolean;
  imageStyleId: string;
  customImageStyle: string;
  /** Подгонять цвета изображений под палитру слайдов */
  matchImageColors: boolean;
  themeId: string;
}

export interface Brief {
  topic: string;
  audience: string;
  goal: string;
  format: string;
  tone: string;
  slideCount: number;
  language: string;
  extra: string;
}

export interface Settings {
  /** chatgpt — без ключа, через обычный ChatGPT; api — автоматически через API-ключ */
  mode: "chatgpt" | "api";
  apiKey: string;
  textModel: string;
  imageModel: string;
  imageQuality: "low" | "medium" | "high";
}

export interface Project {
  brief: Brief;
  design: Design;
  slides: Slide[];
  caption: string;
  hashtags: string[];
}

/** Ответ модели с текстами карусели */
export interface GeneratedCarousel {
  slides: Array<{
    kind: SlideKind;
    eyebrow: string;
    title: string;
    body: string;
    imagePrompt: string;
  }>;
  caption: string;
  hashtags: string[];
}

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
