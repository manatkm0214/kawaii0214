import { NextRequest, NextResponse } from "next/server";

type AIProvider = "openai" | "gemini" | "claude";

type AIRequestBody = {
  provider?: AIProvider;
  type: string;
  data: Record<string, unknown>;
};

type ProviderResponse = {
  text: string;
  provider: AIProvider;
};

function buildPrompt(type: string, data: Record<string, unknown>) {
  const d = data;
  const arr = (value: unknown) => (Array.isArray(value) ? value : []);
  const obj = (value: unknown) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

  if (type === "category") {
    return `You classify household budget entries.
Choose the single best category from the candidate list.

Memo: "${d.memo ?? ""}"
Transaction type: ${d.transactionType ?? ""}
Candidate categories: ${arr(d.categories).join(", ")}

Return only the category name.`;
  }

  if (type === "analysis") {
    const allocationTargets = obj(d.allocationTargets);
    const allocationActual = obj(d.allocationActual);
    return `You are a household budget analyst.
Analyze the monthly data and return JSON only.

Data:
- income: ${d.income ?? ""}
- expense: ${d.expense ?? ""}
- saving: ${d.saving ?? ""}
- investment: ${d.investment ?? ""}
- savingRate: ${d.savingRate ?? ""}%
- fixedRate: ${d.fixedRate ?? ""}%
- takeHome: ${d.takeHome ?? d.income ?? ""}
- allocationTargets: ${JSON.stringify(allocationTargets)}
- allocationActual: ${JSON.stringify(allocationActual)}
- forecast: ${JSON.stringify(d.forecast ?? {})}
- budgetProgress: ${JSON.stringify(arr(d.budgetProgress))}
- categoryExpenses: ${JSON.stringify(d.categoryExpenses ?? {})}

Return:
{
  "summary": "2-3 sentence summary",
  "positives": ["positive 1", "positive 2"],
  "warnings": ["warning 1", "warning 2"],
  "actions": ["action 1", "action 2", "action 3"],
  "actions_detailed": [
    {"title":"action", "expected_impact_yen": 3000, "priority":"high"},
    {"title":"action", "expected_impact_yen": 1500, "priority":"medium"},
    {"title":"action", "expected_impact_yen": 800, "priority":"low"}
  ]
}`;
  }

  if (type === "savings_plan") {
    return `You create a practical savings plan for a household.
Return JSON only.

Goal: ${d.goal ?? ""}
Fixed expenses: ${d.fixedExpenses ?? ""}
Variable expenses: ${d.variableExpenses ?? ""}
Income: ${d.income ?? ""}

Return:
{
  "fixed_savings": ["idea 1", "idea 2"],
  "variable_savings": ["idea 1", "idea 2"],
  "income_boost": ["idea 1", "idea 2"],
  "monthly_save": "estimated monthly saving",
  "summary": "short summary"
}`;
  }

  if (type === "annual") {
    return `You are a yearly household budget analyst.
Past 12 months data: ${JSON.stringify(d.monthlyData ?? {})}

Return JSON only:
{
  "annual_summary": "3-4 sentence annual summary",
  "best_month": "best month and why",
  "worst_month": "worst month and why",
  "trend": "yearly trend analysis",
  "next_year": "3 concise recommendations for next year"
}`;
  }

  if (type === "life_advice") {
    return `You provide practical lifestyle advice from household budget data.
Return JSON only.

Current month: ${d.currentMonth ?? ""}
Income: ${d.income ?? ""}
Expense: ${d.expense ?? ""}
Saving rate: ${d.savingRate ?? ""}%
Category expenses: ${JSON.stringify(d.categoryExpenses ?? {})}

Return:
{
  "life_score": 75,
  "life_comment": "short overview",
  "patterns": [
    {"label": "food", "score": 80, "comment": "comment"},
    {"label": "leisure", "score": 60, "comment": "comment"},
    {"label": "self_growth", "score": 70, "comment": "comment"},
    {"label": "health", "score": 65, "comment": "comment"}
  ],
  "advice": ["advice 1", "advice 2", "advice 3"],
  "next_month_goal": "single next-month goal"
}`;
  }

  if (type === "food_lifestyle") {
    const pantryItems = arr(d.pantryItems).map((item) => {
      const pantry = obj(item);
      return {
        name: pantry.name ?? "",
        amount: pantry.amount ?? "",
        expiresInDays: pantry.expiresInDays ?? null,
      };
    });

    return `You are an assistant inside a household-budget app.
Generate realistic cooking and lifestyle suggestions based on pantry items, area, and this month's budget pace.

Rules:
- Return JSON only
- If lang is "ja", write all user-facing text in Japanese
- If lang is "en", write all user-facing text in English
- Provide up to 3 recipes
- Provide up to 3 lifestyleSuggestions
- Prioritize using pantryItems
- Avoid unrealistic or overly expensive ideas

Input:
- lang: ${d.lang ?? "ja"}
- currentMonth: ${d.currentMonth ?? ""}
- area: ${d.area ?? ""}
- mode: ${d.mode ?? "save"}
- pantryItems: ${JSON.stringify(pantryItems)}
- stats: ${JSON.stringify(obj(d.stats))}

Return:
{
  "summary": "short overview",
  "recipes": [
    {
      "title": "recipe name",
      "reason": "why this fits",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "steps": ["step 1", "step 2", "step 3"],
      "missingIngredients": ["missing ingredient 1"],
      "level": "save"
    }
  ],
  "lifestyleSuggestions": [
    {
      "title": "suggestion title",
      "body": "specific advice",
      "budgetLabel": "short label"
    }
  ]
}`;
  }

  if (type === "input_board_suggest") {
    const lang = d.lang ?? "ja";
    return `You are a household budget app assistant.
Based on the user's recent transaction history, suggest which categories, units, and payment methods are most useful to show as quick-buttons in the input form.
Return JSON only. ${lang === "ja" ? "Write labels in Japanese." : "Write labels in English."}

Available categories per type:
${JSON.stringify(d.availableCategories ?? {})}

Available payment methods: ${arr(d.availablePayments).join(", ")}
Available units (as multiplier numbers): ${arr(d.availableUnits).join(", ")}

Recent transaction summary:
- Top categories used: ${JSON.stringify(d.topCategories ?? {})}
- Top payment methods: ${JSON.stringify(d.topPayments ?? [])}
- Units typically used: ${JSON.stringify(d.topUnits ?? [])}

Suggest the most relevant subset. Include at least 3 categories per type. Return:
{
  "categories": {
    "income": ["category1", "category2"],
    "expense": ["category1", "category2"],
    "saving": ["category1"],
    "investment": ["category1"]
  },
  "units": [1, 1000],
  "payments": ["method1", "method2"],
  "reason": "one-line reason in the user's language"
}`;
  }

  if (type === "calendar_advice") {
    return `You are a calendar-based household budget advisor.
Use yearly cashflow and this month's data to suggest timing-aware advice.
Return JSON only.

Current month: ${d.currentMonth ?? ""}
Monthly data for 12 months: ${JSON.stringify(d.monthlyData ?? {})}
Current category expenses: ${JSON.stringify(d.categoryExpenses ?? {})}
Calendar event count: ${d.eventCount ?? 0}

Return:
{
  "month_summary": "one-line summary",
  "calendar_tips": ["tip 1", "tip 2", "tip 3"],
  "upcoming_warnings": ["warning 1", "warning 2"],
  "best_saving_day": "timing suggestion",
  "annual_pattern": "one-line annual pattern"
}`;
  }

  return "";
}

function extractErrorMessage(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const message = errorRecord.message;
    if (typeof message === "string") return message;
  }
  return null;
}

async function requestOpenAI(prompt: string): Promise<ProviderResponse> {
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
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = (await response.json()) as Record<string, unknown>;
  const parsed = raw as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";

  if (!response.ok || !text) {
    throw new Error(extractErrorMessage(raw) || "OpenAI response could not be generated.");
  }

  return { text, provider: "openai" };
}

async function requestGemini(prompt: string): Promise<ProviderResponse> {
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

  const raw = (await response.json()) as Record<string, unknown>;
  const parsed = raw as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText =
    parsed.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!response.ok || !rawText) {
    throw new Error(extractErrorMessage(raw) || "Gemini response could not be generated.");
  }

  const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  return { text, provider: "gemini" };
}

async function requestClaude(prompt: string): Promise<ProviderResponse> {
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
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = (await response.json()) as Record<string, unknown>;
  const parsed = raw as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = parsed.content?.find((item) => item.type === "text")?.text?.trim() ?? "";

  if (!response.ok || !text) {
    throw new Error(extractErrorMessage(raw) || "Claude response could not be generated.");
  }

  return { text, provider: "claude" };
}

async function requestByProvider(provider: AIProvider, prompt: string) {
  if (provider === "gemini") return requestGemini(prompt);
  if (provider === "claude") return requestClaude(prompt);
  return requestOpenAI(prompt);
}

function getProviderOrder(preferred: AIProvider): AIProvider[] {
  const ordered: AIProvider[] = [preferred, "openai", "gemini", "claude"];
  return ordered.filter((provider, index) => ordered.indexOf(provider) === index);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AIRequestBody;
  const provider = body.provider ?? "openai";
  const prompt = buildPrompt(body.type, body.data ?? {});

  if (!prompt) {
    return NextResponse.json({ error: "Unsupported AI request type." }, { status: 400 });
  }

  const errors: string[] = [];

  for (const candidate of getProviderOrder(provider)) {
    try {
      const result = await requestByProvider(candidate, prompt);
      return NextResponse.json({ result: result.text, provider: result.provider });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI response could not be generated.";
      errors.push(`${candidate}: ${message}`);
    }
  }

  return NextResponse.json(
    { error: errors.join(" / ") || "AI response could not be generated." },
    { status: 502 },
  );
}
