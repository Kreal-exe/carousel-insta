"use client";

// Режим «через ChatGPT»: без API-ключа, на обычной подписке ChatGPT.
// Приложение готовит задание → пользователь открывает его в chatgpt.com →
// вставляет ответ обратно (тексты) и перетаскивает скачанные картинки.

import type { Brief, GeneratedCarousel, SlideKind } from "./types";
import { SYSTEM_PROMPT, briefPrompt, titleVariantsTask } from "./openai";

const JSON_SHAPE = `{
  "slides": [
    { "kind": "cover", "eyebrow": "…", "title": "…", "body": "…", "imagePrompt": "…" },
    { "kind": "content", "eyebrow": "…", "title": "…", "body": "…", "imagePrompt": "…" },
    { "kind": "cta", "eyebrow": "…", "title": "…", "body": "…", "imagePrompt": "…" }
  ],
  "caption": "…",
  "hashtags": ["…", "…"]
}`;

/** Полное задание для ChatGPT: правила + бриф + строгий формат ответа */
export function carouselTaskPrompt(brief: Brief): string {
  return `${SYSTEM_PROMPT}

ЗАДАНИЕ
${briefPrompt(brief)}

ФОРМАТ ОТВЕТА
Ответь ОДНИМ блоком кода \`\`\`json без пояснений до и после. Структура:
${JSON_SHAPE}
Не генерируй изображения на этом шаге — только JSON.`;
}

export function titleVariantsPrompt(...args: Parameters<typeof titleVariantsTask>): string {
  return `${SYSTEM_PROMPT}\n\n${titleVariantsTask(...args)}\n\nОтветь нумерованным списком из 5 вариантов, без пояснений.`;
}

/** Одно задание на всю серию картинок, чтобы они получились в едином стиле */
export function imagesTaskPrompt(prompts: string[]): string {
  const list = prompts.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
  return `Сгенерируй серию из ${prompts.length} изображений для слайдов Instagram-карусели. Каждое — ВЕРТИКАЛЬНОЕ (портрет 4:5 или 2:3), без какого-либо текста, букв и логотипов. Все изображения должны выглядеть как одна серия: одинаковый стиль, свет и цветовая гамма.

Делай строго по порядку, по одному изображению на пункт. Если все сразу не получается — сделай первое и продолжай, когда я напишу «дальше».

${list}`;
}

/** Открывает ChatGPT с заданием. Задание всегда копируется в буфер — на случай, если не подставится само. */
export async function openInChatGPT(prompt: string): Promise<"prefilled" | "clipboard"> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(prompt);
    copied = true;
  } catch {
    // нет доступа к буферу — полагаемся на подстановку через ?q=
  }
  const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  // слишком длинные ссылки браузеры и серверы режут — тогда только буфер обмена
  const tooLong = url.length > 12000;
  window.open(tooLong && copied ? "https://chatgpt.com/" : url, "_blank", "noopener");
  return tooLong && copied ? "clipboard" : "prefilled";
}

const KINDS: SlideKind[] = ["cover", "content", "cta"];

/** Разбирает ответ ChatGPT: достаёт JSON из блока кода или из текста и мягко чинит поля */
export function parseCarouselAnswer(text: string): GeneratedCarousel {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  let raw = fenced ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("В ответе не найден JSON. Скопируйте ответ ChatGPT целиком (кнопка «Копировать» под сообщением).");
  }
  raw = raw.slice(start, end + 1);

  // Пробуем как есть, затем чиним типичные поломки: висячие запятые и «умные» кавычки вместо обычных
  const attempts = [
    raw,
    raw.replace(/,\s*([}\]])/g, "$1"),
    raw.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1"),
  ];
  let data: { slides?: unknown; caption?: unknown; hashtags?: unknown } | null = null;
  for (const attempt of attempts) {
    try {
      data = JSON.parse(attempt);
      break;
    } catch {
      // следующая попытка
    }
  }
  if (!data) {
    throw new Error("Не удалось прочитать JSON из ответа. Попросите ChatGPT: «Верни только JSON одним блоком кода».");
  }
  const slides = (Array.isArray(data.slides) ? data.slides : []) as Array<Record<string, unknown>>;
  if (slides.length < 2) throw new Error("В ответе нет слайдов — проверьте, что скопировали весь ответ.");

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    slides: slides.map((s, i) => {
      const kind = KINDS.includes(s.kind as SlideKind)
        ? (s.kind as SlideKind)
        : i === 0
          ? "cover"
          : i === slides.length - 1
            ? "cta"
            : "content";
      return {
        kind,
        eyebrow: str(s.eyebrow),
        title: str(s.title),
        body: str(s.body),
        imagePrompt: str(s.imagePrompt ?? s.image_prompt),
      };
    }),
    caption: str(data.caption),
    hashtags: (Array.isArray(data.hashtags) ? data.hashtags : [])
      .map((h) => String(h).replace(/^#/, "").replace(/\s+/g, ""))
      .filter(Boolean),
  };
}

/** Время из имени файла ChatGPT («ChatGPT Image …, 02_52_10 PM.png») в секундах, если оно есть */
function timeFromName(name: string): number | null {
  const m = name.match(/(\d{1,2})[_.:](\d{2})[_.:](\d{2})\s*([AP]M)?/i);
  if (!m) return null;
  const hour = Number(m[1]);
  const ampm = m[4]?.toUpperCase();
  const h = ampm ? (hour % 12) + (ampm === "PM" ? 12 : 0) : hour;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Порядок картинок = порядок генерации: по времени в имени файла, иначе по имени */
export function sortImageFiles(files: File[]): File[] {
  return [...files].sort((a, b) => {
    const ta = timeFromName(a.name);
    const tb = timeFromName(b.name);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name, undefined, { numeric: true }) || a.lastModified - b.lastModified;
  });
}
