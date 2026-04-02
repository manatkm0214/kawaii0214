import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { type, data } = await req.json()

  let prompt = ""

  if (type === "category") {
    prompt = `家計簿アプリのAIアシスタントです。
以下のメモから最適なカテゴリを1つだけ提案してください。
メモ: "${data.memo}"
種別: ${data.transactionType}
利用可能カテゴリ: ${data.categories.join(", ")}
カテゴリ名のみ返してください。`
  } else if (type === "analysis") {
    prompt = `家計簿AIアナリストです。以下のデータを分析し、日本語で回答してください。

今月のデータ:
- 収入合計: ${data.income}円
- 支出合計: ${data.expense}円
- 貯金合計: ${data.saving}円
- 投資合計: ${data.investment}円
- 貯蓄率: ${data.savingRate}%
- 固定費率: ${data.fixedRate}%
- カテゴリ別支出: ${JSON.stringify(data.categoryExpenses)}

以下の形式でJSON回答してください（マークダウン記法なし）:
{
  "summary": "今月の総評（2-3文）",
  "positives": ["良い点1", "良い点2"],
  "warnings": ["注意点1", "注意点2"],
  "actions": ["来月のアクション1", "来月のアクション2", "来月のアクション3"]
}`
  } else if (type === "savings_plan") {
    prompt = `家計改善プランナーです。
目標: ${data.goal}
現在の固定費: ${data.fixedExpenses}円
現在の変動費: ${data.variableExpenses}円
収入: ${data.income}円

具体的な節約プランをJSON形式で返してください（マークダウン記法なし）:
{
  "fixed_savings": ["固定費削減案1（金額付き）", "固定費削減案2"],
  "variable_savings": ["変動費削減案1", "変動費削減案2"],
  "income_boost": ["収入アップ案1", "収入アップ案2"],
  "monthly_save": "月間節約見込み額（円）",
  "summary": "プランの総評"
}`
  } else if (type === "annual") {
    prompt = `家計年間レポートアナリストです。
過去12ヶ月のデータ: ${JSON.stringify(data.monthlyData)}

以下のJSON形式で年間総評を返してください（マークダウン記法なし）:
{
  "annual_summary": "年間の総評（3-4文）",
  "best_month": "最も良かった月と理由",
  "worst_month": "最も厳しかった月と理由",
  "trend": "年間トレンドの分析",
  "next_year": "来年へのアドバイス3点"
}`
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  const result = await response.json()
  const text = result.content?.[0]?.text ?? ""

  return NextResponse.json({ result: text })
}