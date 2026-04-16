import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type Provider = "openai" | "gemini";

type RequestBody = {
  provider?: Provider;
  prompt?: string;
  characterName?: string;
  theme?: "dark" | "light";
};

type DesignImageErrorCode =
  | "OPENAI_BILLING_LIMIT"
  | "OPENAI_CONFIG"
  | "GEMINI_CONFIG"
  | "OPENAI_NO_IMAGE"
  | "GEMINI_NO_IMAGE"
  | "IMAGE_GENERATION_FAILED";

function buildPrompt(body: RequestBody) {
  const prompt = body.prompt?.trim() || "";
  const characterName = body.characterName?.trim();
  const themeNote =
    body.theme === "dark"
      ? "soft evening mood with jewel-like highlights and cozy cinematic lighting"
      : "bright airy mood with pastel sparkle and soft studio lighting";

  return [
    "Create one high-quality character portrait for a household-budget app.",
    "Single character only.",
    "Bust-up composition, centered, clean background.",
    "Use a polished cute illustration style that can support either a semi-realistic girl or a fluffy plush mascot depending on the user's request.",
    "If the subject is human, keep natural facial proportions, soft skin shading, detailed hair strands, and a warm gentle expression.",
    "If the subject is a plush mascot, use soft fabric texture, subtle stitching, rounded silhouette, and toy-like charm.",
    "Prefer ribbons, frills, pastel accessories, and boutique-kawaii styling over princess or fantasy-royal cues.",
    "Avoid chibi proportions, harsh cel shading, oversized anime eyes, crowns, castles, and video-game princess references.",
    "No text, no watermark, no extra hands, no collage.",
    "Cute polished mobile-app visual, safe for all ages.",
    `Visual mood: ${themeNote}.`,
    characterName ? `Character name or concept: ${characterName}.` : "",
    prompt
      ? `User request: ${prompt}.`
      : "User request: semi-realistic cute girl with ribbon styling, soft smile, pastel fashion, and a cozy polished portrait feel.",
  ]
    .filter(Boolean)
    .join(" ");
}


async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const result = await client.images.generate({
    model,
    prompt,
    size: "1024x1024",
    quality: "high",
    output_format: "png",
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error("OpenAI did not return an image.");
  }

  return {
    imageUrl: `data:image/png;base64,${imageBase64}`,
    model,
  };
}

async function generateWithGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const result = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
  };

  for (const part of result.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return {
        imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        model,
      };
    }
  }

  throw new Error("Gemini did not return an image.");
}

function isOpenAIBillingLimitError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("billing hard limit") ||
    message.includes("insufficient_quota") ||
    message.includes("insufficient quota") ||
    message.includes("quota exceeded")
  );
}

function normalizeDesignImageError(error: unknown): { code: DesignImageErrorCode; message: string; status: number } {
  const message = error instanceof Error ? error.message : "Image generation failed.";
  const lower = message.toLowerCase();

  if (lower.includes("billing hard limit") || lower.includes("insufficient_quota") || lower.includes("insufficient quota")) {
    return {
      code: "OPENAI_BILLING_LIMIT",
      message: "OpenAI image generation is temporarily unavailable because the billing limit has been reached. Please use Gemini or try again later.",
      status: 429,
    };
  }

  if (lower.includes("openai_api_key")) {
    return {
      code: "OPENAI_CONFIG",
      message: "OpenAI image generation is not configured.",
      status: 500,
    };
  }

  if (lower.includes("gemini_api_key")) {
    return {
      code: "GEMINI_CONFIG",
      message: "Gemini image generation is not configured.",
      status: 500,
    };
  }

  if (lower.includes("openai did not return an image")) {
    return {
      code: "OPENAI_NO_IMAGE",
      message: "OpenAI could not return an image this time. Please try again.",
      status: 502,
    };
  }

  if (lower.includes("gemini did not return an image")) {
    return {
      code: "GEMINI_NO_IMAGE",
      message: "Gemini could not return an image this time. Please try again.",
      status: 502,
    };
  }

  return {
    code: "IMAGE_GENERATION_FAILED",
    message,
    status: 500,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const provider: Provider = body.provider === "openai" ? "openai" : "gemini";
    const prompt = buildPrompt(body);
    let resolvedProvider: Provider = provider;
    let fallbackNotice: string | undefined;

    const generated =
      provider === "openai"
        ? await generateWithOpenAI(prompt).catch(async (error: unknown) => {
            if (isOpenAIBillingLimitError(error) && process.env.GEMINI_API_KEY?.trim()) {
              resolvedProvider = "gemini";
              fallbackNotice = "OPENAI_BILLING_LIMIT_FALLBACK_TO_GEMINI";
              return generateWithGemini(prompt);
            }
            throw error;
          })
        : await generateWithGemini(prompt);

    return NextResponse.json({
      imageUrl: generated.imageUrl,
      provider: resolvedProvider,
      requestedProvider: provider,
      model: generated.model,
      prompt,
      fallbackNotice,
    });
  } catch (error) {
    const normalized = normalizeDesignImageError(error);
    return NextResponse.json({ error: normalized.message, errorCode: normalized.code }, { status: normalized.status });
  }
}
