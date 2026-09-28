"use client";

// Работа через обычный ChatGPT (по подписке, без API-ключа): приложение готовит задание,
// открывает chatgpt.com, а результат пользователь вставляет обратно (текст) или перетаскивает (картинки).

import { WRITING_RULES, carouselRequest } from "./openai";

/** Задание на тексты: ответ приходит в формате поля «Одним текстом» */
export function textTaskPrompt(topic: string, count: number): string {
  return `${WRITING_RULES}

${carouselRequest(topic, count)}

ФОРМАТ ОТВЕТА — только текст слайдов, без пояснений и без «Слайд 1»:
- слайды разделяй отдельной строкой ===
- первый абзац слайда — заголовок, затем пустая строка и текст слайда
- ключевые слова выделяй **так**`;
}

/** Одно задание на всю серию картинок, чтобы они получились в едином стиле */
export function imagesTaskPrompt(prompts: string[]): string {
  const list = prompts.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
  return `Сгенерируй серию из ${prompts.length} изображений для слайдов Instagram-карусели. Каждое — ВЕРТИКАЛЬНОЕ (портрет 4:5 или 2:3), без какого-либо текста, букв и логотипов. Все изображения — одна серия: одинаковый стиль, свет и цветовая гамма.

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
