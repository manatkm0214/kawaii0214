import { NextRequest, NextResponse } from "next/server";

type AIRequestBody = {
  provider: "openai" | "gemini";
  type: string;
  data: Record<string, unknown>;
};
export async function POST(req: NextRequest) {
  const { provider = "openai", type, data }: AIRequestBody = await req.json();

  let prompt = "";
  // data型ガード
  const d: Record<string, unknown> = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
  // 型安全な参照用関数
  const arr = (v: unknown) => Array.isArray(v) ? v : [];
  const obj = (v: unknown) => (typeof v === "object" && v !== null ? v as Record<string, unknown> : {});
  if (type === "category") {
    prompt = `家計簿アプリのAIアシスタントです。\n以下のメモから最適なカテゴリを1つだけ提案してください。\nメモ: "${d.memo ?? ""}"\n種別: ${d.transactionType ?? ""}\n利用可能カテゴリ: ${arr(d.categories).join(", ")}\nカテゴリ名のみ返してください。`;
  } else if (type === "analysis") {
    const allocationTargets = obj(d.allocationTargets);
    const allocationActual = obj(d.allocationActual);
    prompt = `家計簿AIアナリストです。以下のデータを分析し、日本語で回答してください。\n\n今月のデータ:\n- 収入合計: ${d.income ?? ""}円\n- 支出合計: ${d.expense ?? ""}円\n- 貯金合計: ${d.saving ?? ""}円\n- 投資合計: ${d.investment ?? ""}円\n- 貯蓄率: ${d.savingRate ?? ""}%\n- 固定費率: ${d.fixedRate ?? ""}%\n- 手取り(基準): ${d.takeHome ?? d.income ?? ""}円\n- 目標配分: 固定費${allocationTargets.fixed ?? "-"}%以下 / 変動費${allocationTargets.variable ?? "-"}%以下 / 貯蓄${allocationTargets.savings ?? "-"}%以上\n- 実績配分: 固定費${allocationActual.fixed ?? "-"}% / 変動費${allocationActual.variable ?? "-"}% / 貯蓄${allocationActual.savings ?? "-"}%\n- 月末予測: ${JSON.stringify(d.forecast ?? {})}\n- 予算進捗: ${JSON.stringify(arr(d.budgetProgress))}\n- カテゴリ別支出: ${JSON.stringify(d.categoryExpenses ?? {})}\n\n以下の形式でJSON回答してください（マークダウン記法なし）:\n{\n  "summary": "今月の総評（2-3文、初心者にもわかる言葉）",\n  "positives": ["良い点1", "良い点2"],\n  "warnings": ["注意点1", "注意点2"],\n  "actions": ["来月のアクション1", "来月のアクション2", "来月のアクション3"],\n  "actions_detailed": [\n    {"title":"実行アクション", "expected_impact_yen": 3000, "priority":"high"},\n    {"title":"実行アクション", "expected_impact_yen": 1500, "priority":"medium"},\n    {"title":"実行アクション", "expected_impact_yen": 800, "priority":"low"}\n  ]\n}`;
  } else if (type === "savings_plan") {
    prompt = `家計改善プランナーです。\n目標: ${d.goal ?? ""}\n現在の固定費: ${d.fixedExpenses ?? ""}円\n現在の変動費: ${d.variableExpenses ?? ""}円\n収入: ${d.income ?? ""}円\n\n具体的な節約プランをJSON形式で返してください（マークダウン記法なし）:\n{\n  "fixed_savings": ["固定費削減案1（金額付き）", "固定費削減案2"],\n  "variable_savings": ["変動費削減案1", "変動費削減案2"],\n  "income_boost": ["収入アップ案1", "収入アップ案2"],\n  "monthly_save": "月間節約見込み額（円）",\n  "summary": "プランの総評"\n}`;
  } else if (type === "annual") {
    prompt = `家計年間レポートアナリストです。\n過去12ヶ月のデータ: ${JSON.stringify(d.monthlyData ?? {})}\n\n以下のJSON形式で年間総評を返してください（マークダウン記法なし）:\n{\n  "annual_summary": "年間の総評（3-4文）",\n  "best_month": "最も良かった月と理由",\n  "worst_month": "最も厳しかった月と理由",\n  "trend": "年間トレンドの分析",\n  "next_year": "来年へのアドバイス3点"\n}`;
  } else if (type === "life_advice") {
    prompt = `生活の質アドバイザーです。家計データから生活パターンを分析し、家計と生活習慣の両面からアドバイスをしてください。\n\n対象月: ${d.currentMonth ?? ""}\n収入: ${d.income ?? ""}円\n支出: ${d.expense ?? ""}円\n貯蓄率: ${d.savingRate ?? ""}%\nカテゴリ別支出: ${JSON.stringify(d.categoryExpenses ?? {})}\n\n分析の観点:\n- 食費・外食の割合から食生活の豊かさや健康度を推測する\n- 娯楽・趣味費から余暇・休息のバランスを推測する\n- 教育・書籍費から自己投資の姿勢を推測する\n- 医療・スポーツ費から健康管理への意識を推測する\n- 交通費から行動範囲・活動量を推測する\n\n以下のJSON形式で返してください（マークダウン記法なし）:\n{\n  "life_score": 75,\n  "life_comment": "総合的な生活の質スコア（100点満点）とその理由2文",\n  "patterns": [\n    {"label": "食生活", "score": 80, "comment": "外食と食費のバランスから推測した一言"},\n    {"label": "娯楽・休息", "score": 60, "comment": "娯楽費から推測"},\n    {"label": "自己投資", "score": 70, "comment": "教育・書籍費から推測"},\n    {"label": "健康管理", "score": 65, "comment": "医療・スポーツ費から推測"}\n  ],\n  "advice": [\n    "具体的な生活改善アドバイス1（家計と生活の両面から）",\n    "アドバイス2",\n    "アドバイス3"\n  ],\n  "next_month_goal": "来月の生活目標（家計だけでなく生活習慣を含む1文）"\n}`;
  } else if (type === "calendar_advice") {
    prompt = `家計カレンダーアドバイザーです。年間の収支データから重要なイベントや注意点をアドバイスしてください。\n\n対象月: ${d.currentMonth ?? ""}\n12ヶ月の月別データ: ${JSON.stringify(d.monthlyData ?? {})}\n今月のカテゴリ別支出: ${JSON.stringify(d.categoryExpenses ?? {})}\nカレンダー予定数: ${d.eventCount ?? 0}件\n\n以下のJSON形式で返してください（マークダウン記法なし）:\n{\n  "month_summary": "今月の家計の一言コメント（1文）",\n  "calendar_tips": [\n    "今月のカレンダー活用アドバイス1（例：給料日直後の大きな出費に注意）",\n    "アドバイス2（例：月末に光熱費の締め日が重なりやすい）",\n    "アドバイス3"\n  ],\n  "upcoming_warnings": [\n    "来月・翌月の注意点1（季節的な出費など）",\n    "注意点2"\n  ],\n  "best_saving_day": "お金を使いにくい・節約しやすいタイミングの提案（1文）",\n  "annual_pattern": "年間を通じた支出パターンの特徴（1文）"\n}`;
  }

  if (!prompt) {
    return NextResponse.json({ error: "不正なリクエスト種別です" }, { status: 400 });
  }

  // プロバイダーごとにAPI分岐
  let apiUrl = "";
  let apiHeaders: Record<string, string> = {};
  let apiBody: Record<string, unknown> = {};
  let parseResponse: (raw: string) => string = () => "";

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-3.5-turbo";
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY が未設定です" }, { status: 500 });
    }
    apiUrl = "https://api.openai.com/v1/chat/completions";
    apiHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
    apiBody = {
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    };
    parseResponse = (raw) => {
      let result: Record<string, unknown> | null = null;
      try { result = raw ? JSON.parse(raw) : null; } catch { return ""; }
      if (
        result &&
        Array.isArray((result as { choices?: unknown[] }).choices) &&
        typeof ((result as { choices: unknown[] }).choices[0]) === "object" &&
        (result as { choices: unknown[] }).choices[0] !== null &&
        typeof (((result as { choices: { message?: { content?: unknown } }[] }).choices[0].message?.content)) === "string"
      ) {
        return ((result as { choices: { message: { content: string } }[] }).choices[0].message.content).trim();
      }
      return "";
    };
  } else if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-pro";
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY が未設定です" }, { status: 500 });
    }
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    apiHeaders = { "Content-Type": "application/json" };
    apiBody = { contents: [{ parts: [{ text: prompt }] }] };
    parseResponse = (raw) => {
      let result: Record<string, unknown> | null = null;
      try { result = raw ? JSON.parse(raw) : null; } catch { return ""; }
      if (
        result &&
        Array.isArray((result as { candidates?: unknown[] }).candidates) &&
        typeof ((result as { candidates: unknown[] }).candidates[0]) === "object" &&
        (result as { candidates: unknown[] }).candidates[0] !== null &&
        typeof (((result as { candidates: { content?: { parts?: { text?: unknown }[] } }[] }).candidates[0].content?.parts?.[0]?.text)) === "string"
      ) {
        return (((result as { candidates: { content: { parts: { text: string }[] } }[] }).candidates[0].content.parts[0].text)).trim();
      }
      return "";
    };
  } else {
    return NextResponse.json({ error: "未対応のAIプロバイダーです" }, { status: 400 });
  }

  // 共通API呼び出し
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(apiBody),
  });
  const raw = await response.text();
  const text = parseResponse(raw);

  if (!response.ok || !text) {
    return NextResponse.json({ error: "AIから有効な回答が返りませんでした" }, { status: response.status || 502 });
  }

  return NextResponse.json({ result: text });
}