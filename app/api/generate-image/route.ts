import type { ImageGenerateParams } from "openai/resources/images";
import { errorResponse, getClient, HttpError } from "@/lib/server";
import { imageSizeFor } from "@/lib/imagePrompt";

export const runtime = "nodejs";
// Генерация одной картинки может занимать до пары минут
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { prompt, model, quality } = (await req.json()) as {
      prompt: string;
      model?: string;
      quality?: "low" | "medium" | "high";
    };
    if (!prompt?.trim()) throw new HttpError(400, "Пустой промпт для изображения");

    const imageModel = model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const client = getClient(req);

    const params: ImageGenerateParams = {
      model: imageModel,
      prompt,
      n: 1,
      size: imageSizeFor(imageModel),
    };
    if (imageModel.startsWith("dall-e")) {
      // DALL·E 3: вертикальный формат, ответ base64
      params.size = "1024x1792";
      params.response_format = "b64_json";
    } else {
      params.quality = quality ?? "medium";
      params.output_format = "jpeg";
      params.output_compression = 92;
    }

    const result = await client.images.generate(params);
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new HttpError(502, "OpenAI не вернул изображение");
    const mime = params.output_format === "jpeg" ? "image/jpeg" : "image/png";
    return Response.json({ image: `data:${mime};base64,${b64}` });
  } catch (err) {
    return errorResponse(err);
  }
}
