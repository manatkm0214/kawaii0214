import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { AIProvider, AIRequestBody } from "@/app/ai"

type AnthropicTextBlock = {
  type?: string
  text?: string
}

type AnthropicResponseLike = {
  content?: AnthropicTextBlock[]
}

function buildPrompt(type: AIRequestBody["type"], data: AIRequestBody["data"]) {
  if (type === "category") {
    const { memo, transactionType, categories } = data as {
      memo: string
      transactionType: string
      categories: string[]
    }
    return `家計簿アプリのAIアシスタントです。
以下のメモから最適なカテゴリを1つだけ提案してください。
メモ: "${memo}"
種別: ${transactionType}
利用可能カテゴリ: ${categories.join(", ")}
カテゴリ名のみ返してください。`
  }


  if (type === "analysis") {
    const {
      income,
      expense,
      saving,
      investment,
      savingRate,
      fixedRate,
      takeHome,
      allocationTargets,
      allocationActual,
      forecast,
      budgetProgress,
      categoryExpenses,
    } = data as {
      income: number
      expense: number
      saving: number
      investment: number
      savingRate: number
      fixedRate: number
      takeHome?: number
      allocationTargets?: { fixed?: number; variable?: number; savings?: number }
      allocationActual?: { fixed?: number; variable?: number; savings?: number }
      forecast?: unknown
      budgetProgress?: unknown
      categoryExpenses?: unknown
    }
    return `家計簿AIアナリストです。以下のデータを分析し、日本語で回答してください。

今月のデータ:
- 収入合計: ${income}円
- 支出合計: ${expense}円
- 貯金合計: ${saving}円
- 投資合計: ${investment}円
- 貯蓄率: ${savingRate}%
- 固定費率: ${fixedRate}%
- 手取り(基準): ${takeHome ?? income}円
- 目標配分: 固定費${allocationTargets?.fixed ?? "-"}%以下 / 変動費${allocationTargets?.variable ?? "-"}%以下 / 貯蓄${allocationTargets?.savings ?? "-"}%以上
- 実績配分: 固定費${allocationActual?.fixed ?? "-"}% / 変動費${allocationActual?.variable ?? "-"}% / 貯蓄${allocationActual?.savings ?? "-"}%
- 月末予測: ${JSON.stringify(forecast ?? {})}
- 予算進捗: ${JSON.stringify(budgetProgress ?? [])}
- カテゴリ別支出: ${JSON.stringify(categoryExpenses)}

以下の形式でJSON回答してください（マークダウン記法なし）:
{
  "summary": "今月の総評（2-3文、初心者にもわかる言葉）",
  "positives": ["良い点1", "良い点2"],
  "warnings": ["注意点1", "注意点2"],
  "actions": ["来月のアクション1", "来月のアクション2", "来月のアクション3"],
  "actions_detailed": [
    {"title":"実行アクション", "expected_impact_yen": 3000, "priority":"high"},
    {"title":"実行アクション", "expected_impact_yen": 1500, "priority":"medium"},
    {"title":"実行アクション", "expected_impact_yen": 800, "priority":"low"}
  ]
}`
  }

  if (type === "savings_plan") {
    const {
      goal,
      fixedExpenses,
      variableExpenses,
      income,
    } = data as {
      goal: string
      fixedExpenses: number
      variableExpenses: number
      income: number
    }
    return `家計改善プランナーです。
目標: ${goal}
現在の固定費: ${fixedExpenses}円
現在の変動費: ${variableExpenses}円
収入: ${income}円

具体的な節約プランをJSON形式で返してください（マークダウン記法なし）:
{
  "fixed_savings": ["固定費削減案1（金額付き）", "固定費削減案2"],
  "variable_savings": ["変動費削減案1", "変動費削減案2"],
  "income_boost": ["収入アップ案1", "収入アップ案2"],
  "monthly_save": "月間節約見込み額（円）",
  "summary": "プランの総評"
}`
  }

  if (type === "annual") {
    const { monthlyData } = data as { monthlyData: unknown }
    return `家計年間レポートアナリストです。
過去12ヶ月のデータ: ${JSON.stringify(monthlyData)}

以下のJSON形式で年間総評を返してください（マークダウン記法なし）:
{
  "annual_summary": "年間の総評（3-4文）",
  "best_month": "最も良かった月と理由",
  "worst_month": "最も厳しかった月と理由",
  "trend": "年間トレンドの分析",
  "next_year": "来年へのアドバイス3点"
}`
  }

  if (type === "life_advice") {
    const {
      currentMonth,
      income,
      expense,
      savingRate,
      categoryExpenses,
    } = data as {
      currentMonth: string
      income: number
      expense: number
      savingRate: number
      categoryExpenses: unknown
    }
    return `生活の質アドバイザーです。家計データから生活パターンを分析し、家計と生活習慣の両面からアドバイスをしてください。

対象月: ${currentMonth}
収入: ${income}円
支出: ${expense}円
貯蓄率: ${savingRate}%
カテゴリ別支出: ${JSON.stringify(categoryExpenses)}

分析の観点:
- 食費・外食の割合から食生活の豊かさや健康度を推測する
- 娯楽・趣味費から余暇・休息のバランスを推測する
- 教育・書籍費から自己投資の姿勢を推測する
- 医療・スポーツ費から健康管理への意識を推測する
- 交通費から行動範囲・活動量を推測する

以下のJSON形式で返してください（マークダウン記法なし）:
{
  "life_score": 75,
  "life_comment": "総合的な生活の質スコア（100点満点）とその理由2文",
  "patterns": [
    {"label": "食生活", "score": 80, "comment": "外食と食費のバランスから推測した一言"},
    {"label": "娯楽・休息", "score": 60, "comment": "娯楽費から推測"},
    {"label": "自己投資", "score": 70, "comment": "教育・書籍費から推測"},
    {"label": "健康管理", "score": 65, "comment": "医療・スポーツ費から推測"}
  ],
  "advice": [
    "具体的な生活改善アドバイス1（家計と生活の両面から）",
    "アドバイス2",
    "アドバイス3"
  ],
  "next_month_goal": "来月の生活目標（家計だけでなく生活習慣を含む1文）"
}`
  }

  if (type === "calendar_advice") {
    const {
      currentMonth,
      monthlyData,
      categoryExpenses,
      eventCount,
    } = data as {
      currentMonth: string
      monthlyData: unknown
      categoryExpenses?: unknown
      eventCount?: number
    }
    return `家計カレンダーアドバイザーです。年間の収支データから重要なイベントや注意点をアドバイスしてください。

対象月: ${currentMonth}
12ヶ月の月別データ: ${JSON.stringify(monthlyData)}
今月のカテゴリ別支出: ${JSON.stringify(categoryExpenses ?? {})}
カレンダー予定数: ${eventCount ?? 0}件

以下のJSON形式で返してください（マークダウン記法なし）:
{
  "month_summary": "今月の家計の一言コメント（1文）",
  "calendar_tips": [
    "今月のカレンダー活用アドバイス1（例：給料日直後の大きな出費に注意）",
    "アドバイス2（例：月末に光熱費の締め日が重なりやすい）",
    "アドバイス3"
  ],
  "upcoming_warnings": [
    "来月・翌月の注意点1（季節的な出費など）",
    "注意点2"
  ],
  "best_saving_day": "お金を使いにくい・節約しやすいタイミングの提案（1文）",
  "annual_pattern": "年間を通じた支出パターンの特徴（1文）"
}`
  }

  return ""
}

function extractJsonIfWrapped(text: string) {
  const cleaned = text.trim()

  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    return cleaned
  }

  const match = cleaned.match(/```json\s*([\s\S]*?)```/i) || cleaned.match(/```([\s\S]*?)```/i)
  if (match?.[1]) {
    return match[1].trim()
  }

  return cleaned
}

async function askOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY が未設定です")
  }

  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "あなたは家計簿アプリ ReBalance のAIアシスタントです。日本語で、わかりやすく、必要ならJSONのみ返してください。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim()

  if (!text) {
    throw new Error("OpenAIから有効な回答が返りませんでした")
  }

  return text
}

async function askClaude(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest"

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が未設定です")
  }

  const client = new Anthropic({ apiKey })

  const response = (await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  })) as AnthropicResponseLike

  const text = Array.isArray(response.content)
    ? response.content
        .map((block) => (typeof block?.text === "string" ? block.text : ""))
        .join("\n")
        .trim()
    : ""

  if (!text) {
    throw new Error("Claudeから有効な回答が返りませんでした")
  }

  return text
}

async function askGemini(prompt: string) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash"

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY が未設定です")
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({ model })

  const response = await geminiModel.generateContent(prompt)
  const text = response.response.text().trim()

  if (!text) {
    throw new Error("Geminiから有効な回答が返りませんでした")
  }

  return text
}

async function askByProvider(provider: AIProvider, prompt: string) {
  if (provider === "openai") return askOpenAI(prompt)
  if (provider === "gemini") return askGemini(prompt)
  return askClaude(prompt)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIRequestBody
    const provider: AIProvider = body.provider ?? "claude"
    const prompt = buildPrompt(body.type, body.data)

    if (!prompt) {
      return NextResponse.json({ error: "不正なリクエスト種別です" }, { status: 400 })
    }

    const rawText = await askByProvider(provider, prompt)
    const result = extractJsonIfWrapped(rawText)

    return NextResponse.json({
      provider,
      result,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI呼び出しに失敗しました"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}