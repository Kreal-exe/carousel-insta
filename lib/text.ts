import type { Slide } from "./types";
import { MAX_SLIDES } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptySlide(text = ""): Slide {
  return { id: uid(), text };
}

// ---------- Разметка слайда ----------

export type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "hr" }
  | { t: "quote"; lines: string[] }
  | { t: "box"; items: Array<{ big: boolean; text: string }> };

/** Разбирает текст слайда на блоки. Если меток «#» нет — первый абзац становится заголовком. */
export function parseSlide(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", text: para.join("\n") });
    para = [];
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      flush();
    } else if (/^-{3,}$/.test(line)) {
      flush();
      blocks.push({ t: "hr" });
    } else if (line.startsWith(">")) {
      flush();
      const content = line.replace(/^>\s?/, "");
      if (last?.t === "quote") last.lines.push(content);
      else blocks.push({ t: "quote", lines: [content] });
    } else if (line.startsWith("!")) {
      flush();
      const content = line.replace(/^!\s?/, "");
      const item = { big: content.startsWith("#"), text: content.replace(/^#\s?/, "") };
      if (last?.t === "box") last.items.push(item);
      else blocks.push({ t: "box", items: [item] });
    } else if (line.startsWith("#")) {
      const content = line.replace(/^#+\s?/, "");
      // строки с # подряд — один заголовок в несколько строк
      if (para.length === 0 && last?.t === "h") last.text += "\n" + content;
      else {
        flush();
        blocks.push({ t: "h", text: content });
      }
    } else {
      para.push(line);
    }
  }
  flush();
  if (!blocks.some((b) => b.t === "h")) {
    const i = blocks.findIndex((b) => b.t === "p");
    if (i >= 0) blocks[i] = { t: "h", text: (blocks[i] as { text: string }).text };
  }
  return blocks;
}

/** Первая строка без разметки — для подписей в списке слайдов */
export function plainPreview(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/^[#>!\s-]+/, "").replace(/\*\*/g, "").trim())
      .find(Boolean) ?? ""
  );
}

// ---------- «Одним текстом» ----------

export const SLIDE_SEPARATOR = "===";

export function slidesToText(slides: Slide[]): string {
  return slides.map((s) => s.text.trim()).join(`\n\n${SLIDE_SEPARATOR}\n\n`);
}

/** Слайды разделяются строкой «===». Фото и фон остаются за слайдом с тем же номером. */
export function textToSlides(text: string, prev: Slide[]): Slide[] {
  const parts = text
    .replace(/\r/g, "")
    .split(/^\s*={3,}\s*$/m)
    .map((p) => p.trim())
    .slice(0, MAX_SLIDES);
  return parts.map((t, i) => ({ ...(prev[i] ?? emptySlide()), text: t }));
}

/** Каждый абзац (через пустую строку) — отдельный слайд; первая строка абзаца — заголовок */
export function paragraphsToSlides(text: string, prev: Slide[]): Slide[] {
  const paras = text
    .replace(/\r/g, "")
    .replace(/^\s*={3,}\s*$/gm, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, MAX_SLIDES);
  return paras.map((p, i) => {
    const [first, ...rest] = p.split("\n");
    const body = rest.join("\n").trim();
    return { ...(prev[i] ?? emptySlide()), text: body ? `${first}\n\n${body}` : first };
  });
}

/** Делит сплошной текст на N слайдов по предложениям, выравнивая объём */
export function autoSplit(text: string, count: number, prev: Slide[]): Slide[] {
  const clean = text.replace(/\r/g, "").replace(/^\s*={3,}\s*$/gm, "").replace(/\s*\n\s*/g, " ").trim();
  if (!clean) return prev;
  const sentences =
    clean.match(/[^.!?…]+[.!?…]+["»)]*\s*|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  const n = Math.max(1, Math.min(count, sentences.length, MAX_SLIDES));
  const target = sentences.reduce((a, s) => a + s.length, 0) / n;

  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  sentences.forEach((s, i) => {
    cur.push(s);
    len += s.length;
    const remaining = sentences.length - i - 1;
    const needed = n - chunks.length - 1; // сколько ещё слайдов нужно после текущего
    if (needed > 0 && (len >= target || remaining === needed)) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
  });
  if (cur.length) chunks.push(cur);

  // первое предложение — заголовок, остальное — текст
  return chunks.map(([first, ...rest], i) => ({
    ...(prev[i] ?? emptySlide()),
    text: rest.length ? `${first}\n\n${rest.join(" ")}` : first,
  }));
}

// ---------- Пример ----------

export const SAMPLE_SLIDES = [
  `# Ты это и так знаешь сама,
но всё время
**забываешь**, что…`,
  `Твоя внутренняя удовлетворённость и правда с собой **важнее, чем одобрение других.**`,
  `Твои сомнения в себе — это **проверка,**
а не правда.`,
  `Если ты не отдыхаешь — ты **эксплуатируешь себя.**
---
А значит, будешь чувствовать себя **использованной.**`,
  `Скроллинг ленты — это **не отдых.**

Он не восстанавливает. **Он сжигает твой главный ресурс.**

! Даже два главных ресурса:
! # **Время и Внимание.**`,
  `Когда внимание тебе не принадлежит,

# ты ощущаешь, что **другие люди тебя не ценят.**`,
  `> Оно у мужчины, который опять не ответил на сообщение.
> У мамы, которая опять не так посмотрела.
> У коллеги. У ленты. У завтрашнего дня.

! # А себе мы отдаём то, **что осталось после всех.**
! И потом удивляемся, что с нами обращаются так же :)`,
  `# **26 сентября**
# начинаем открытую неделю практики — **возвращаем своё внимание вовнутрь.**
---
Напиши **«Хочу»** в комментариях, и тебе придёт ссылка на телеграм-канал, где будут все материалы.`,
];
