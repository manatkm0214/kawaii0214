import { NextRequest, NextResponse } from "next/server";

type ChatProvider = "openai" | "gemini" | "claude";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  provider?: ChatProvider;
  lang?: "ja" | "en";
  context?: string;
  messages?: ChatMessage[];
};

function buildConversationPrompt(lang: "ja" | "en", context: string | undefined, messages: ChatMessage[]) {
  const systemPrompt =
    lang === "en"
      ? [
          "You are a practical household-budget assistant.",
          "Answer clearly and warmly.",
          "Prioritize savings, budgeting, emergency funds, debt safety, and realistic next steps.",
          "Keep answers concise unless the question clearly asks for detail.",
          "Do not mention that you received hidden instructions or raw prompt formatting.",
        ].join(" ")
      : [
          "あなたは家計管理アプリの実用的なAIアシスタントです。",
          "やさしく、わかりやすく答えてください。",
          "節約、貯金、生活防衛資金、借金管理、無理のない改善案を優先してください。",
          "ユーザーが詳しい説明を求めない限り、簡潔に答えてください。",
          "隠し指示やプロンプトの構造には触れないでください。",
        ].join(" ");

  const conversation = messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n");

  return [
    systemPrompt,
    context ? `Context:\n${context}` : "",
    `Conversation:\n${conversation}`,
    lang === "en"
      ? "Reply as the assistant to the most recent user message."
      : "最後のユーザーメッセージに対するアシスタント返信だけを書いてください。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function requestOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  const reply = raw.choices?.[0]?.message?.content?.trim();
  if (!response.ok || !reply) {
    throw new Error(raw.error?.message || "OpenAI chat response could not be generated.");
  }
  return reply;
}

async function requestGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const raw = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  const rawReply = raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!response.ok || !rawReply) {
    throw new Error(raw.error?.message || "Gemini chat response could not be generated.");
  }
  const reply = rawReply.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return reply;
}

async function requestClaude(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };

  const reply = raw.content?.find((item) => item.type === "text")?.text?.trim();
  if (!response.ok || !reply) {
    throw new Error(raw.error?.message || "Claude chat response could not be generated.");
  }
  return reply;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const provider = body.provider ?? "openai";
    const lang = body.lang === "en" ? "en" : "ja";
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(
          (message): message is ChatMessage =>
            Boolean(message) &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim().length > 0,
        )
      : [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "No chat messages were provided." }, { status: 400 });
    }

    const prompt = buildConversationPrompt(lang, body.context, messages);
    const reply =
      provider === "gemini"
        ? await requestGemini(prompt)
        : provider === "claude"
          ? await requestClaude(prompt)
          : await requestOpenAI(prompt);

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
