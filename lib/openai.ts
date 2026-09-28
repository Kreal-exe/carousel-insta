"use client";

import { imageSizeFor } from "./imagePrompt";

// Статический сайт (GitHub Pages): запросы к OpenAI идут прямо из браузера с ключом пользователя.
// Ключ хранится только в localStorage этого браузера.
const API = "https://api.openai.com/v1";

// Правила вирусных каруселей: хук на обложке, одна мысль на слайд, открытая петля, призыв в конце.
export const WRITING_RULES = `Ты — сильный SMM-копирайтер. Пиши Instagram-карусель по правилам:
1. Слайд 1 — ХУК: заголовок до 8 слов (смелое утверждение, цифра, контринтуитивная мысль или обещание результата), под ним одна короткая строка-подводка.
2. Средние слайды — одна мысль на слайд, как флеш-карточка: заголовок до 7 слов и 15–30 слов текста простыми словами, без воды. Интригу из обложки раскрывай ближе к концу.
3. Последний слайд — короткий итог и конкретный призыв: сохранить, отправить другу или написать слово в комментарии/директ.
4. В заголовках выдели 1–2 ключевых слова двойными звёздочками: **так**.
5. Без эмодзи и хэштегов на слайдах, без канцелярита.`;

export function carouselRequest(topic: string, count: number): string {
  return `Тема: ${topic}\nКоличество слайдов: ${count}. Язык: русский (если тема на другом языке — на языке темы).`;
}

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

type ChatResponse = { choices: Array<{ message: { content: string | null } }> };

/** Тексты карусели через API: возвращает слайды и подпись к посту */
export async function generateCarousel(
  topic: string,
  count: number,
  apiKey: string,
  model: string,
): Promise<{ slides: Array<{ title: string; body: string }>; caption: string }> {
  const res = await call<ChatResponse>("/chat/completions", apiKey, {
    model: model || "gpt-5.5",
    messages: [
      { role: "system", content: WRITING_RULES },
      { role: "user", content: carouselRequest(topic, count) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "carousel",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["slides", "caption"],
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "body"],
                properties: { title: { type: "string" }, body: { type: "string" } },
              },
            },
            caption: { type: "string" },
          },
        },
      },
    },
  });
  const content = res.choices?.[0]?.message?.content;
  if (!content) throw new Error("Модель вернула пустой ответ");
  return JSON.parse(content);
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
