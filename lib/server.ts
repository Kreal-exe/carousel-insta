import OpenAI from "openai";

/** Ключ берём из заголовка (введён в UI) либо из переменной окружения. */
export function getClient(req: Request): OpenAI {
  const apiKey = req.headers.get("x-openai-key")?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      401,
      "Не задан ключ OpenAI. Укажите его в настройках (⚙) или в переменной окружения OPENAI_API_KEY.",
    );
  }
  return new OpenAI({ apiKey });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 500;
    let message = err.message;
    if (status === 401) message = "OpenAI отклонил ключ (401). Проверьте API-ключ.";
    if (status === 429) message = "Превышен лимит запросов OpenAI или закончился баланс (429).";
    if (status === 403 && /verif/i.test(err.message)) {
      message =
        "Для моделей GPT Image OpenAI требует верификацию организации (Settings → Organization → Verify). " +
        err.message;
    }
    return Response.json({ error: message }, { status });
  }
  console.error(err);
  return Response.json(
    { error: err instanceof Error ? err.message : "Неизвестная ошибка" },
    { status: 500 },
  );
}
