import type { Brief, GeneratedCarousel } from "@/lib/types";
import { errorResponse, getClient, HttpError } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

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
} as const;

export async function POST(req: Request) {
  try {
    const { brief, model } = (await req.json()) as { brief: Brief; model?: string };
    if (!brief?.topic?.trim()) throw new HttpError(400, "Укажите тему карусели");
    const count = Math.min(Math.max(Number(brief.slideCount) || 8, 3), 20);

    const userPrompt = [
      `Тема: ${brief.topic}`,
      brief.audience && `Целевая аудитория: ${brief.audience}`,
      `Цель поста: ${brief.goal}`,
      `Тон: ${brief.tone}`,
      `Язык текста на слайдах и подписи: ${brief.language || "русский"}`,
      `Количество слайдов: ровно ${count} (1 cover, ${count - 2} content, 1 cta).`,
      brief.extra && `Дополнительные пожелания: ${brief.extra}`,
    ]
      .filter(Boolean)
      .join("\n");

    const client = getClient(req);
    const completion = await client.chat.completions.create({
      model: model || process.env.OPENAI_TEXT_MODEL || "gpt-5.5",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "carousel", strict: true, schema: SCHEMA },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new HttpError(502, "Модель вернула пустой ответ");
    const data = JSON.parse(content) as GeneratedCarousel;
    data.hashtags = data.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, ""));
    return Response.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
