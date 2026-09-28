"use client";

import type { Brief, GeneratedCarousel, Slide } from "./types";
import { FORMATS } from "./presets";
import { imageSizeFor } from "./imagePrompt";

// Приложение статическое (GitHub Pages), поэтому запросы к OpenAI идут прямо из браузера
// с ключом пользователя. Ключ хранится только в localStorage этого браузера.
const API = "https://api.openai.com/v1";

// Правила собраны из актуальных гайдов по каруселям (2025–2026):
// хук на первом слайде, одна мысль на слайд, открытая петля, CTA в конце.
const SYSTEM_PROMPT = `Ты — сильный SMM-копирайтер и контент-стратег, который пишет вирусные Instagram-карусели.

Правила, которые ты соблюдаешь всегда:
1. Слайд 1 (kind="cover") — ХУК. Заголовок до 8 слов: смелое утверждение, контринтуитивная мысль, конкретный результат или цифра. Он должен остановить скролл и заставить свайпнуть. body — одна короткая строка-подводка (до 12 слов) или пусто.
2. Средние слайды (kind="content") — одна мысль на слайд, как флеш-карточка. Заголовок до 7 слов, body — 12–35 слов, простыми словами, без воды. Каждый слайд логично ведёт к следующему; используй «открытую петлю» — интригу из первого слайда раскрывай ближе к концу.
3. Последний слайд (kind="cta") — короткое резюме + конкретный призыв: сохранить, отправить другу, написать слово в комментарии или директ. Призыв должен соответствовать цели карусели.
4. eyebrow — очень короткая надпись над заголовком (например «Шаг 1», «Ошибка №2», «Миф», «Итог»). Для обложки можно указать рубрику или оставить пустым.
5. В заголовках выдели 1–2 самых важных слова двойными звёздочками: **так**. Не выделяй больше двух фрагментов.
6. Никаких эмодзи в заголовках, хэштегов на слайдах, канцелярита и клише вроде «в современном мире».
7. imagePrompt — на АНГЛИЙСКОМ, 1–2 предложения: конкретная визуальная сцена/метафора к слайду (объекты, место, свет, настроение, ракурс). Все изображения должны выглядеть как одна серия. Никакого текста, букв, цифр, логотипов в изображении. Не описывай художественный стиль — его добавят отдельно.
8. caption — подпись к посту: цепляющая первая строка (до 125 символов, видна до «ещё»), 2–4 коротких абзаца пользы, в конце вопрос к аудитории или призыв. hashtags — 5–10 релевантных хэштегов без символа #.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["slides", "caption", "hashtags"],
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "eyebrow", "title", "body", "imagePrompt"],
        properties: {
          kind: { type: "string", enum: ["cover", "content", "cta"] },
          eyebrow: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          imagePrompt: { type: "string" },
        },
      },
    },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
};

async function call<T>(path: string, apiKey: string, body: unknown): Promise<T> {
  if (!apiKey.trim()) {
    throw new Error("Не задан ключ OpenAI. Откройте настройки (⚙) и вставьте API-ключ.");
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Не удалось связаться с OpenAI — проверьте интернет или VPN.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error("OpenAI отклонил ключ (401). Проверьте API-ключ в настройках.");
    if (res.status === 429) throw new Error("Превышен лимит запросов OpenAI или закончился баланс (429).");
    if (res.status === 403 && /verif/i.test(msg)) {
      throw new Error(
        "Для моделей GPT Image OpenAI требует верификацию организации (platform.openai.com → Settings → Organization → Verify). " +
          msg,
      );
    }
    throw new Error(msg);
  }
  return data as T;
}

export async function generateCarousel(brief: Brief, apiKey: string, model: string): Promise<GeneratedCarousel> {
  if (!brief.topic.trim()) throw new Error("Укажите тему карусели");
  const count = Math.min(Math.max(Number(brief.slideCount) || 8, 3), 20);
  const userPrompt = [
    `Тема: ${brief.topic}`,
    brief.audience && `Целевая аудитория: ${brief.audience}`,
    `Цель поста: ${brief.goal}`,
    `Формат: ${(FORMATS.find((f) => f.id === brief.format) ?? FORMATS[0]).prompt}`,
    `Тон: ${brief.tone}`,
    `Язык текста на слайдах и подписи: ${brief.language || "русский"}`,
    `Количество слайдов: ровно ${count} (1 cover, ${count - 2} content, 1 cta).`,
    brief.extra && `Дополнительные пожелания: ${brief.extra}`,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await call<ChatResponse>(
    "/chat/completions",
    apiKey,
    {
      model: model || "gpt-5.5",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "carousel", strict: true, schema: SCHEMA } },
    },
  );
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("Модель вернула пустой ответ");
  const data = JSON.parse(content) as GeneratedCarousel;
  data.hashtags = data.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, ""));
  return data;
}

type ChatResponse = { choices: Array<{ message: { content: string | null } }> };

/** 5 альтернативных заголовков для слайда (для обложки — варианты хука) */
export async function generateTitleVariants(
  slide: Slide,
  slides: Slide[],
  brief: Brief,
  apiKey: string,
  model: string,
): Promise<string[]> {
  const context = slides.map((s, i) => `${i + 1}. [${s.kind}] ${s.title.replace(/\*\*/g, "")}`).join("\n");
  const task =
    slide.kind === "cover"
      ? "Придумай 5 сильных альтернативных ХУКОВ для обложки: разные приёмы — цифра, контринтуитивное утверждение, обещание результата, провокационный вопрос, «ошибка, которую делают все». До 8 слов."
      : slide.kind === "cta"
        ? "Придумай 5 вариантов заголовка для финального слайда с призывом (сохранить / поделиться / написать в директ). До 7 слов."
        : "Придумай 5 альтернативных заголовков для этого слайда: короче, точнее, цепляюще. До 7 слов.";
  const res = await call<ChatResponse>("/chat/completions", apiKey, {
    model: model || "gpt-5.5",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Тема карусели: ${brief.topic}\nТон: ${brief.tone}\nЯзык: ${brief.language || "русский"}\nВсе слайды:\n${context}\n\nТекущий слайд: «${slide.title}» — ${slide.body}\n\n${task} Выдели 1–2 ключевых слова **звёздочками**.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "variants",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["titles"],
          properties: { titles: { type: "array", items: { type: "string" } } },
        },
      },
    },
  });
  const content = res.choices?.[0]?.message?.content;
  if (!content) throw new Error("Модель вернула пустой ответ");
  return (JSON.parse(content) as { titles: string[] }).titles.slice(0, 5);
}

export async function generateImage(
  prompt: string,
  apiKey: string,
  model: string,
  quality: "low" | "medium" | "high",
): Promise<string> {
  const imageModel = model || "gpt-image-2";
  const body: Record<string, unknown> = { model: imageModel, prompt, n: 1, size: imageSizeFor(imageModel) };
  let mime = "image/jpeg";
  if (imageModel.startsWith("dall-e")) {
    body.size = "1024x1792";
    body.response_format = "b64_json";
    mime = "image/png";
  } else {
    body.quality = quality;
    body.output_format = "jpeg";
    body.output_compression = 92;
  }
  const result = await call<{ data?: Array<{ b64_json?: string }> }>("/images/generations", apiKey, body);
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI не вернул изображение");
  return `data:${mime};base64,${b64}`;
}
