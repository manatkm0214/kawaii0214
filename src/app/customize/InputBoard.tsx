"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIES, CATEGORY_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
  TransactionType, Transaction, Budget, formatCurrency, PASSIVE_INCOME_CATEGORIES,
} from "../../lib/utils";
import { useLang } from "../../lib/hooks/useLang";
import { useAIProvider, setAIProvider, AI_PROVIDERS } from "../../lib/hooks/useAIProvider";

// ─── 定数 ───────────────────────────────────────────────────────────────────

const UNITS = [
  { labelJa: "円",  labelEn: "Yen", factor: 1     },
  { labelJa: "千円", labelEn: "1K",  factor: 1000  },
  { labelJa: "万円", labelEn: "10K", factor: 10000 },
] as const;

const TRANSACTION_TABS: { key: TransactionType; ja: string; en: string }[] = [
  { key: "income",     ja: "収入", en: "Income"  },
  { key: "expense",    ja: "支出", en: "Expense"  },
  { key: "saving",     ja: "貯蓄", en: "Savings"  },
  { key: "investment", ja: "投資", en: "Invest"   },
];

const WASTE_CATEGORIES = ["娯楽", "レジャー", "趣味", "美容・衣服", "サブスク"];

const ALLOCATION_PRESETS = [
  { nameJa: "標準",        nameEn: "Standard",     saving: 20, expense: 70, investment: 10, descJa: "安定収入・バランス重視",   descEn: "Stable income, balanced" },
  { nameJa: "貯金重視",    nameEn: "Save-first",   saving: 40, expense: 50, investment: 10, descJa: "目標額・住宅購入準備",     descEn: "Building toward a goal" },
  { nameJa: "節約",        nameEn: "Frugal",       saving: 30, expense: 65, investment:  5, descJa: "収入が不安定・緊急時",     descEn: "Unstable income / emergency" },
  { nameJa: "FIRE・投資重視", nameEn: "FIRE/Invest", saving: 10, expense: 60, investment: 30, descJa: "FIRE志向・高収入層",    descEn: "FIRE-oriented / high income" },
  { nameJa: "今を楽しむ",  nameEn: "Live now",     saving: 15, expense: 80, investment:  5, descJa: "若手・習慣づけ重視",      descEn: "Young / building habits" },
];

const CATEGORY_TARGETS = [
  { keys: ["住居"],                labelJa: "住居費",      labelEn: "Housing",     low: 25, high: 30, noteJa: "収入の30%超は要注意",      noteEn: "Watch if over 30% of income" },
  { keys: ["食費"],                labelJa: "食費",        labelEn: "Food",        low: 15, high: 20, noteJa: "外食含む",                 noteEn: "Including eating out" },
  { keys: ["水道・光熱費"],        labelJa: "水道・光熱費", labelEn: "Utilities",   low:  4, high:  9, noteJa: "水道・電気・ガス合算",      noteEn: "Water + electricity + gas" },
  { keys: ["通信費"],              labelJa: "通信費",      labelEn: "Phone/Net",   low:  3, high:  5, noteJa: "格安SIM推奨",              noteEn: "Consider budget carriers" },
  { keys: ["娯楽", "レジャー", "趣味"], labelJa: "娯楽・レジャー", labelEn: "Leisure", low: 10, high: 15, noteJa: "浪費率に影響",         noteEn: "Affects waste rate" },
  { keys: ["医療費"],              labelJa: "医療・健康",   labelEn: "Health",      low:  3, high:  5, noteJa: "予防投資として重要",       noteEn: "Important preventive investment" },
];

// ─── localStorage ────────────────────────────────────────────────────────────

const STORAGE_KEY_CATEGORIES = (type: TransactionType) => `kakeibo-custom-categories-${type}`;
const STORAGE_KEY_UNITS     = "kakeibo-custom-units";
const STORAGE_KEY_PAYMENTS  = "kakeibo-custom-payments";
const STORAGE_KEY_AI_ON     = "kakeibo-input-board-ai-on";

function readNum(key: string) {
  if (typeof window === "undefined") return 0;
  const v = Number(localStorage.getItem(key) ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function loadSet(key: string, defaults: string[]): Set<string> {
  if (typeof window === "undefined") return new Set(defaults);
  const raw = localStorage.getItem(key);
  if (!raw) return new Set(defaults);
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(defaults); }
}

function saveSet(key: string, values: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...values]));
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function monthKey(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function tone(value: number, good: number, warn: number, higherIsBetter: boolean): "good" | "warn" | "bad" {
  if (higherIsBetter) {
    if (value >= good) return "good";
    if (value >= warn) return "warn";
    return "bad";
  } else {
    if (value <= good) return "good";
    if (value <= warn) return "warn";
    return "bad";
  }
}

function toneClass(t: "good" | "warn" | "bad") {
  if (t === "good") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (t === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function toneBadge(t: "good" | "warn" | "bad", lang: "ja" | "en") {
  if (t === "good") return lang === "en" ? "Good"   : "良好";
  if (t === "warn") return lang === "en" ? "Watch"  : "注意";
  return lang === "en" ? "Review" : "改善";
}

// ─── AI提案型 ────────────────────────────────────────────────────────────────

interface AISuggestion {
  categories: Record<TransactionType, string[]>;
  units: number[];
  payments: string[];
  reason: string;
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function InputBoardCustomize() {
  const lang = useLang();
  const t = useCallback((ja: string, en: string) => (lang === "en" ? en : ja), [lang]);
  const aiProvider = useAIProvider();

  // ボタン設定 state
  const [tab, setTab] = useState<TransactionType>("expense");
  const [categorySelections, setCategorySelections] = useState<Record<TransactionType, Set<string>>>({
    income: new Set(), expense: new Set(), saving: new Set(), investment: new Set(),
  });
  const [unitSelections,    setUnitSelections]    = useState<Set<string>>(new Set());
  const [paymentSelections, setPaymentSelections] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  // AI state
  const [aiOn,         setAiOn]         = useState(false);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiError,      setAiError]      = useState("");

  // データ state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets,      setBudgets]      = useState<Budget[]>([]);
  const [dataLoading,  setDataLoading]  = useState(true);

  // 初期化
  useEffect(() => {
    setCategorySelections({
      income:     loadSet(STORAGE_KEY_CATEGORIES("income"),     CATEGORIES.income),
      expense:    loadSet(STORAGE_KEY_CATEGORIES("expense"),    CATEGORIES.expense),
      saving:     loadSet(STORAGE_KEY_CATEGORIES("saving"),     CATEGORIES.saving),
      investment: loadSet(STORAGE_KEY_CATEGORIES("investment"), CATEGORIES.investment),
    });
    setUnitSelections(loadSet(STORAGE_KEY_UNITS,    UNITS.map((u) => String(u.factor))));
    setPaymentSelections(loadSet(STORAGE_KEY_PAYMENTS, [...PAYMENT_METHODS]));
    if (localStorage.getItem(STORAGE_KEY_AI_ON) === "1") setAiOn(true);

    void (async () => {
      try {
        const res = await fetch("/api/home-data", { cache: "no-store" });
        const payload = await res.json() as {
          authenticated?: boolean;
          transactions?: Transaction[];
          budgets?: Budget[];
        };
        if (payload.authenticated) {
          setTransactions(payload.transactions ?? []);
          setBudgets(payload.budgets ?? []);
        }
      } finally {
        setDataLoading(false);
      }
    })();

    const refresh = () => {
      void fetch("/api/home-data", { cache: "no-store" })
        .then((r) => r.json())
        .then((p: { transactions?: Transaction[]; budgets?: Budget[] }) => {
          setTransactions(p.transactions ?? []);
          setBudgets(p.budgets ?? []);
        });
    };
    window.addEventListener("kakeibo-data-updated", refresh);
    return () => window.removeEventListener("kakeibo-data-updated", refresh);
  }, []);

  // ─── 指標計算 ───────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const cm = monthKey(0);
    const monthTx = (offset: number) => transactions.filter((tx) => tx.date.startsWith(monthKey(offset)));

    const curr = monthTx(0);
    const income     = curr.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
    const expense    = curr.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
    const saving     = curr.filter((tx) => tx.type === "saving").reduce((s, tx) => s + tx.amount, 0);
    const investment = curr.filter((tx) => tx.type === "investment").reduce((s, tx) => s + tx.amount, 0);
    const fixedExp   = curr.filter((tx) => tx.type === "expense" && tx.is_fixed).reduce((s, tx) => s + tx.amount, 0);
    const wasteExp   = curr.filter((tx) => tx.type === "expense" && WASTE_CATEGORIES.includes(tx.category)).reduce((s, tx) => s + tx.amount, 0);
    const passiveInc = curr.filter((tx) => tx.type === "income" && (PASSIVE_INCOME_CATEGORIES as readonly string[]).includes(tx.category)).reduce((s, tx) => s + tx.amount, 0);

    // 節約率: 予算 - 実績 ÷ 予算
    const budget = budgets.filter((b) => b.month === cm).reduce((s, b) => s + b.amount, 0);
    const savingRate   = pct(saving, income);
    const fixedRate    = pct(fixedExp, income);
    const wasteRate    = pct(wasteExp, expense);
    const frugalRate   = budget > 0 ? Math.round(((budget - expense) / budget) * 100) : null;

    // 先取り貯金達成度
    const savingGoal      = readNum("kakeibo-gen-saving-goal") || readNum("kakeibo-savings-goal");
    const payFirstRate    = savingGoal > 0 ? pct(saving, savingGoal) : null;

    // 防衛資金達成度
    const cumulativeSaving = transactions
      .filter((tx) => tx.type === "saving" || tx.type === "investment")
      .reduce((s, tx) => s + tx.amount, 0);
    const defenseGoal  = readNum("kakeibo-gen-defense-goal");
    const defenseMonths = defenseGoal > 0 ? defenseGoal : 6;
    const defenseTarget = expense * defenseMonths;
    const defenseRate  = defenseTarget > 0 ? pct(cumulativeSaving, defenseTarget) : null;

    // 受動収入率
    const passiveRate  = pct(passiveInc, expense);

    // 収支安定性（過去3ヶ月の収支標準偏差）
    const balances = [0, 1, 2].map((i) => {
      const txs = monthTx(i);
      const inc = txs.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
      const exp = txs.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
      const sav = txs.filter((tx) => tx.type === "saving" || tx.type === "investment").reduce((s, tx) => s + tx.amount, 0);
      return inc - exp - sav;
    });
    const stability = Math.round(stdDev(balances));

    // カテゴリ別支出割合
    const categoryMap: Record<string, number> = {};
    for (const tx of curr.filter((tx) => tx.type === "expense")) {
      categoryMap[tx.category] = (categoryMap[tx.category] ?? 0) + tx.amount;
    }

    return {
      income, expense, saving, investment, fixedExp, wasteExp, passiveInc,
      savingRate, fixedRate, wasteRate, frugalRate,
      payFirstRate, defenseRate, passiveRate, stability, balances,
      savingGoal, cumulativeSaving, defenseMonths, defenseTarget,
      budget, categoryMap,
      actualSavingPct: pct(saving, income),
      actualExpensePct: pct(expense, income),
      actualInvestPct: pct(investment, income),
    };
  }, [transactions, budgets]);

  // ─── ボタン設定ハンドラ ───────────────────────────────────────────────────────

  function handleAiToggle() {
    const next = !aiOn;
    setAiOn(next);
    localStorage.setItem(STORAGE_KEY_AI_ON, next ? "1" : "0");
    if (!next) { setAiSuggestion(null); setAiError(""); }
  }

  async function fetchAiSuggestion() {
    setAiLoading(true); setAiError(""); setAiSuggestion(null);
    const topCounts: Record<string, Record<string, number>> = { income: {}, expense: {}, saving: {}, investment: {} };
    for (const tx of transactions) {
      if (tx.type in topCounts) topCounts[tx.type][tx.category] = (topCounts[tx.type][tx.category] ?? 0) + 1;
    }
    const topCategories = Object.fromEntries(
      Object.entries(topCounts).map(([type, cats]) => [
        type,
        Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c),
      ])
    );
    const paymentCounts: Record<string, number> = {};
    for (const tx of transactions) if (tx.payment_method) paymentCounts[tx.payment_method] = (paymentCounts[tx.payment_method] ?? 0) + 1;
    const topPayments = Object.entries(paymentCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "input_board_suggest",
          provider: aiProvider,
          data: {
            lang,
            availableCategories: CATEGORIES,
            availablePayments: [...PAYMENT_METHODS],
            availableUnits: UNITS.map((u) => u.factor),
            topCategories, topPayments, topUnits: [1, 1000],
          },
        }),
      });
      const { result, error } = await res.json() as { result?: string; error?: string };
      if (!res.ok || error) { setAiError(error ?? t("AI提案の取得に失敗しました", "Failed to get AI suggestion")); return; }
      const parsed = JSON.parse((result ?? "").replace(/```json|```/g, "").trim()) as AISuggestion;
      setAiSuggestion(parsed);
    } catch {
      setAiError(t("AI提案の解析に失敗しました", "Could not parse AI suggestion"));
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return;
    const types: TransactionType[] = ["income", "expense", "saving", "investment"];
    const newCats = Object.fromEntries(types.map((type) => {
      const valid = (aiSuggestion.categories[type] ?? []).filter((c) => (CATEGORIES[type] as string[]).includes(c));
      return [type, valid.length > 0 ? new Set(valid) : new Set(CATEGORIES[type])];
    })) as Record<TransactionType, Set<string>>;
    setCategorySelections(newCats);
    const validUnits = (aiSuggestion.units ?? []).map(String).filter((u) => UNITS.some((x) => String(x.factor) === u));
    setUnitSelections(validUnits.length > 0 ? new Set(validUnits) : new Set(UNITS.map((u) => String(u.factor))));
    const validPay = (aiSuggestion.payments ?? []).filter((p) => (PAYMENT_METHODS as readonly string[]).includes(p));
    setPaymentSelections(validPay.length > 0 ? new Set(validPay) : new Set(PAYMENT_METHODS));
  }

  function toggleCategory(type: TransactionType, value: string) {
    setCategorySelections((prev) => {
      const next = new Set(prev[type]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [type]: next };
    });
  }
  function toggleUnit(factor: number) {
    setUnitSelections((prev) => { const next = new Set(prev); const k = String(factor); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  }
  function togglePayment(method: string) {
    setPaymentSelections((prev) => { const next = new Set(prev); if (next.has(method)) next.delete(method); else next.add(method); return next; });
  }
  function handleApply() {
    for (const type of ["income", "expense", "saving", "investment"] as TransactionType[]) saveSet(STORAGE_KEY_CATEGORIES(type), categorySelections[type]);
    saveSet(STORAGE_KEY_UNITS,    unitSelections);
    saveSet(STORAGE_KEY_PAYMENTS, paymentSelections);
    window.dispatchEvent(new Event("kakeibo-input-board-updated"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  const currentCategories = CATEGORIES[tab];
  const selected = categorySelections[tab];

  // ─── レンダー ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 bg-slate-50 px-4 py-8 text-slate-900">

      {/* ━━━ 家計の目安 ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("家計の目安", "Household highlights")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("各指標の定義・計算式・理想値と現在値を比較します", "Compare each metric definition, formula, and ideal value against your current data")}
        </p>

        {dataLoading ? (
          <p className="mt-4 text-xs text-slate-400">{t("読み込み中...", "Loading...")}</p>
        ) : metrics.income === 0 && metrics.expense === 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            {t("今月のデータがありません。入力すると自動で更新されます。", "No data for this month. Data updates automatically after input.")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* 貯蓄率 */}
            {(() => {
              const v = metrics.savingRate;
              const toneVal = tone(v, 20, 10, true);
              return (
                <MetricCard
                  label={t("貯蓄率", "Savings rate")}
                  formula={t("貯金÷収入×100", "Saving÷Income×100")}
                  value={`${v}%`}
                  ideal={t("20%以上", "20%+")}
                  tone={toneVal}
                  missing={toneVal !== "good" ? t(`あと${Math.max(0, 20 - v)}%不足`, `${Math.max(0, 20 - v)}% short`) : undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 固定費率 */}
            {(() => {
              const v = metrics.fixedRate;
              const toneVal = tone(v, 40, 50, false);
              return (
                <MetricCard
                  label={t("固定費率", "Fixed cost rate")}
                  formula={t("固定費÷収入×100", "Fixed÷Income×100")}
                  value={`${v}%`}
                  ideal={t("40%以下", "40% or less")}
                  tone={toneVal}
                  missing={toneVal !== "good" ? t(`目標比+${Math.max(0, v - 40)}%超過`, `${Math.max(0, v - 40)}% over target`) : undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 浪費率 */}
            {(() => {
              const v = metrics.wasteRate;
              const toneVal = tone(v, 15, 25, false);
              return (
                <MetricCard
                  label={t("浪費率", "Waste rate")}
                  formula={t("娯楽費÷支出×100", "Leisure÷Expense×100")}
                  value={`${v}%`}
                  ideal={t("15%以下", "15% or less")}
                  tone={toneVal}
                  missing={toneVal !== "good" ? t(`娯楽費 ${formatCurrency(metrics.wasteExp)}`, `Leisure: ${formatCurrency(metrics.wasteExp)}`) : undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 節約率 */}
            {metrics.frugalRate !== null && (() => {
              const v = metrics.frugalRate!;
              const toneVal = tone(v, 0, -10, true);
              return (
                <MetricCard
                  label={t("節約率", "Budget adherence")}
                  formula={t("(予算-実績)÷予算×100", "(Budget-Actual)÷Budget×100")}
                  value={`${v}%`}
                  ideal={t("0%以上", "0%+")}
                  tone={toneVal}
                  missing={v < 0 ? t(`予算超過 ${formatCurrency(Math.abs(metrics.expense - metrics.budget))}`, `Over by ${formatCurrency(Math.abs(metrics.expense - metrics.budget))}`) : undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 先取り貯金達成度 */}
            {metrics.payFirstRate !== null && (() => {
              const v = Math.min(metrics.payFirstRate!, 200);
              const toneVal = tone(v, 100, 70, true);
              return (
                <MetricCard
                  label={t("先取り貯金達成度", "Pay-first progress")}
                  formula={t("実際の先取り貯金÷目標×100", "Actual saving÷Goal×100")}
                  value={`${v}%`}
                  ideal={t("100%", "100%")}
                  tone={toneVal}
                  missing={toneVal !== "good" ? t(`あと ${formatCurrency(Math.max(0, metrics.savingGoal - metrics.saving))} 不足`, `Short by ${formatCurrency(Math.max(0, metrics.savingGoal - metrics.saving))}`) : undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 防衛資金達成度 */}
            {metrics.defenseRate !== null && (() => {
              const v = Math.min(metrics.defenseRate!, 200);
              const toneVal = tone(v, 100, 50, true);
              return (
                <MetricCard
                  label={t("防衛資金達成度", "Emergency fund progress")}
                  formula={t("累計貯金÷(月支出×防衛月数)×100", "Savings÷(Expense×Months)×100")}
                  value={`${v}%`}
                  ideal={t("100%（生活費×防衛月数）", "100% (Expense×target months)")}
                  tone={toneVal}
                  missing={toneVal !== "good" ? t(`あと ${formatCurrency(Math.max(0, metrics.defenseTarget - metrics.cumulativeSaving))} 不足`, `Short by ${formatCurrency(Math.max(0, metrics.defenseTarget - metrics.cumulativeSaving))}`) : undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 受動収入率 */}
            {(() => {
              const v = metrics.passiveRate;
              const toneVal = tone(v, 10, 5, true);
              return (
                <MetricCard
                  label={t("受動収入率", "Passive income rate")}
                  formula={t("受動収入÷支出×100", "Passive income÷Expense×100")}
                  value={`${v}%`}
                  ideal={t("10%以上で優秀", "10%+ is excellent")}
                  tone={toneVal}
                  missing={undefined}
                  lang={lang}
                />
              );
            })()}

            {/* 収支安定性 */}
            {(() => {
              const v = metrics.stability;
              const toneVal = v < 30000 ? "good" : v < 80000 ? "warn" : "bad";
              return (
                <MetricCard
                  label={t("収支安定性", "Cashflow stability")}
                  formula={t("過去3ヶ月収支の標準偏差", "Std dev of 3-month cashflow")}
                  value={formatCurrency(v)}
                  ideal={t("低いほど安定", "Lower = more stable")}
                  tone={toneVal}
                  missing={toneVal !== "good" ? t("収入か支出のばらつきが大きめです", "Income or expense varies significantly") : undefined}
                  lang={lang}
                />
              );
            })()}
          </div>
        )}
      </section>

      {/* ━━━ 判断基準 ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("判断基準", "Criteria")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 rounded-2xl border border-slate-200 text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">{t("指標", "Metric")}</th>
                <th className="px-3 py-2 text-left font-semibold">{t("計算式", "Formula")}</th>
                <th className="px-3 py-2 text-left font-semibold text-emerald-700">{t("良好", "Good")}</th>
                <th className="px-3 py-2 text-left font-semibold text-amber-700">{t("注意", "Watch")}</th>
                <th className="px-3 py-2 text-left font-semibold text-rose-700">{t("改善", "Review")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: t("貯蓄率", "Savings rate"),          formula: t("貯金÷収入×100", "Saving÷Income×100"),         good: t("20%以上", "20%+"),         warn: t("10〜19%", "10-19%"),       bad: t("10%未満", "<10%") },
                { label: t("固定費率", "Fixed cost rate"),      formula: t("固定費÷収入×100", "Fixed÷Income×100"),         good: t("40%以下", "≤40%"),          warn: t("41〜50%", "41-50%"),       bad: t("50%超", ">50%") },
                { label: t("浪費率", "Waste rate"),             formula: t("娯楽費÷支出×100", "Leisure÷Expense×100"),      good: t("15%以下", "≤15%"),          warn: t("16〜25%", "16-25%"),       bad: t("25%超", ">25%") },
                { label: t("節約率", "Budget adherence"),       formula: t("(予算-実績)÷予算×100", "(B-A)÷B×100"),        good: t("0%以上", "0%+"),            warn: t("−10〜0%", "−10 to 0%"),    bad: t("−10%未満", "<−10%") },
                { label: t("先取り貯金達成度", "Pay-first"),    formula: t("貯金÷目標×100", "Saving÷Goal×100"),            good: t("100%以上", "100%+"),        warn: t("70〜99%", "70-99%"),       bad: t("70%未満", "<70%") },
                { label: t("防衛資金達成度", "Emergency fund"), formula: t("累計貯金÷目標×100", "Savings÷Target×100"),     good: t("100%以上", "100%+"),        warn: t("50〜99%", "50-99%"),       bad: t("50%未満", "<50%") },
                { label: t("受動収入率", "Passive income"),     formula: t("受動収入÷支出×100", "Passive÷Expense×100"),    good: t("10%以上", "10%+"),          warn: t("5〜9%", "5-9%"),           bad: t("5%未満", "<5%") },
                { label: t("収支安定性", "Stability"),          formula: t("過去3ヶ月の標準偏差", "3-month std dev"),       good: t("3万未満", "<¥30k"),          warn: t("3〜8万", "¥30k-80k"),      bad: t("8万超", ">¥80k") },
              ].map((row) => (
                <tr key={row.label} className="border-t border-slate-100 bg-white">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-slate-500">{row.formula}</td>
                  <td className="px-3 py-2 text-emerald-700">{row.good}</td>
                  <td className="px-3 py-2 text-amber-700">{row.warn}</td>
                  <td className="px-3 py-2 text-rose-700">{row.bad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━━ 配分プリセット ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("配分プリセット", "Allocation presets")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("現在値と比較して参考にしてください", "Compare your current allocation against these presets")}
        </p>

        {!dataLoading && metrics.income > 0 && (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs">
            <span className="font-medium text-slate-700">{t("現在", "Current")}: </span>
            <span className="text-slate-600">
              {t("貯金", "Saving")} {metrics.actualSavingPct}% ／ {t("支出", "Expense")} {metrics.actualExpensePct}% ／ {t("投資", "Invest")} {metrics.actualInvestPct}%
            </span>
          </div>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 rounded-2xl border border-slate-200 text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">{t("プリセット", "Preset")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("貯金", "Saving")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("支出", "Expense")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("投資", "Invest")}</th>
                <th className="px-3 py-2 text-left font-semibold">{t("向いている人", "Best for")}</th>
              </tr>
            </thead>
            <tbody>
              {ALLOCATION_PRESETS.map((preset) => {
                const isCurrent =
                  Math.abs(metrics.actualSavingPct - preset.saving) < 8 &&
                  Math.abs(metrics.actualExpensePct - preset.expense) < 8 &&
                  Math.abs(metrics.actualInvestPct - preset.investment) < 8;
                return (
                  <tr key={preset.nameJa} className={`border-t border-slate-100 ${isCurrent ? "bg-cyan-50" : "bg-white"}`}>
                    <td className="px-3 py-2 font-semibold text-slate-950">
                      {lang === "en" ? preset.nameEn : preset.nameJa}
                      {isCurrent && <span className="ml-1 text-cyan-600">✓</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-medium">{preset.saving}%</td>
                    <td className="px-3 py-2 text-center text-slate-700">{preset.expense}%</td>
                    <td className="px-3 py-2 text-center text-violet-700 font-medium">{preset.investment}%</td>
                    <td className="px-3 py-2 text-slate-600">{lang === "en" ? preset.descEn : preset.descJa}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━━ カテゴリ支出割合の目安 ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("カテゴリ支出割合の目安", "Category spending guide")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("支出合計に占める各カテゴリの割合と推奨範囲", "Each category as % of total expense vs recommended range")}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {CATEGORY_TARGETS.map((target) => {
            const catTotal = target.keys.reduce((sum, k) => sum + (metrics.categoryMap[k] ?? 0), 0);
            const actual   = metrics.expense > 0 ? Math.round((catTotal / metrics.expense) * 100) : null;
            const status   = actual === null ? null : actual < target.low ? "warn" : actual > target.high ? "bad" : "good";
            return (
              <div key={target.labelJa} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{lang === "en" ? target.labelEn : target.labelJa}</p>
                    <p className="text-xs text-slate-500">{lang === "en" ? target.noteEn : target.noteJa}</p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-xs text-slate-400">{t("推奨", "Target")}: {target.low}〜{target.high}%</span>
                    {actual !== null ? (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${toneClass(status!)}`}>
                        {actual}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">{t("データなし", "No data")}</span>
                    )}
                  </div>
                </div>
                {actual !== null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all ${status === "good" ? "bg-emerald-400" : status === "warn" ? "bg-amber-400" : "bg-rose-400"}`}
                      style={{ width: `${Math.min(actual * 3, 100)}%` }}
                    />
                  </div>
                )}
                {status === "bad" && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {t(`推奨上限より +${actual! - target.high}% 超過`, `+${actual! - target.high}% over recommended limit`)}
                  </p>
                )}
                {status === "warn" && catTotal === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    {t("このカテゴリの支出がまだありません", "No spending in this category yet")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ━━━ AI提案 ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">{t("AI提案", "AI Suggestion")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("AIが使用頻度をもとにおすすめのボタン構成を提案します", "AI suggests the best button layout based on your usage")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAiToggle}
            aria-label={t("AI提案のオン/オフ", "Toggle AI suggestion")}
            className={`relative flex h-7 w-12 items-center rounded-full transition ${aiOn ? "bg-cyan-500" : "bg-slate-200"}`}
          >
            <span className={`absolute h-5 w-5 rounded-full bg-white shadow transition-all ${aiOn ? "left-6" : "left-1"}`} />
          </button>
        </div>

        {aiOn && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">{t("プロバイダー", "Provider")}</span>
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setAIProvider(p.key)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${aiProvider === p.key ? `${p.color} text-white` : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchAiSuggestion}
              disabled={aiLoading}
              className="rounded-full border border-cyan-500 bg-cyan-50 px-5 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-40"
            >
              {aiLoading ? t("提案を取得中...", "Getting suggestion...") : t("AIからの提案をみる", "View AI suggestion")}
            </button>

            {aiError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{aiError}</p>
            )}

            {aiSuggestion && (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs font-semibold text-cyan-800">{t("AIの提案", "AI suggestion")}</p>
                {aiSuggestion.reason && <p className="mt-1 text-xs text-cyan-700">{aiSuggestion.reason}</p>}
                <div className="mt-3 space-y-1.5">
                  {TRANSACTION_TABS.map((txTab) => {
                    const cats = aiSuggestion.categories[txTab.key] ?? [];
                    return cats.length > 0 ? (
                      <div key={txTab.key}>
                        <span className="text-xs font-medium text-cyan-900">{lang === "en" ? txTab.en : txTab.ja}: </span>
                        <span className="text-xs text-cyan-800">
                          {cats.map((c) => { const lbl = CATEGORY_LABELS[c]; return lbl ? (lang === "en" ? lbl.en : lbl.ja) : c; }).join("・")}
                        </span>
                      </div>
                    ) : null;
                  })}
                  {aiSuggestion.units.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-cyan-900">{t("単位", "Units")}: </span>
                      <span className="text-xs text-cyan-800">
                        {aiSuggestion.units.map((f) => { const u = UNITS.find((x) => x.factor === f); return u ? (lang === "en" ? u.labelEn : u.labelJa) : String(f); }).join("・")}
                      </span>
                    </div>
                  )}
                  {aiSuggestion.payments.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-cyan-900">{t("支払方法", "Payment")}: </span>
                      <span className="text-xs text-cyan-800">
                        {aiSuggestion.payments.map((m) => { const lbl = PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS]; return lbl ? (lang === "en" ? lbl.en : lbl.ja) : m; }).join("・")}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applyAiSuggestion}
                  className="mt-4 w-full rounded-full bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-400"
                >
                  {t("AI提案を反映する", "Apply AI suggestion")}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ━━━ カテゴリ ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("カテゴリ", "Category")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("表示するカテゴリを選んでください", "Select categories to show")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TRANSACTION_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === item.key ? "bg-cyan-500 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >
              {lang === "en" ? item.en : item.ja}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {currentCategories.map((cat) => {
            const isOn = selected.has(cat);
            const label = CATEGORY_LABELS[cat];
            const display = label ? (lang === "en" ? label.en : label.ja) : cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(tab, cat)}
                className={`rounded-2xl border px-3 py-3 text-left text-sm font-medium transition ${isOn ? "border-cyan-600 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-slate-50 text-slate-400 line-through"}`}
              >
                {display}
              </button>
            );
          })}
        </div>
      </section>

      {/* ━━━ 単位 ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("単位", "Unit")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("表示する単位を選んでください", "Select units to show")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {UNITS.map((u) => {
            const isOn = unitSelections.has(String(u.factor));
            return (
              <button
                key={u.factor}
                type="button"
                onClick={() => toggleUnit(u.factor)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${isOn ? "border-cyan-600 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-slate-50 text-slate-400 line-through"}`}
              >
                {lang === "en" ? u.labelEn : u.labelJa}
              </button>
            );
          })}
        </div>
      </section>

      {/* ━━━ 支払方法 ━━━ */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">{t("支払方法", "Payment method")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("表示する支払方法を選んでください", "Select payment methods to show")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => {
            const isOn = paymentSelections.has(method);
            const label = PAYMENT_METHOD_LABELS[method];
            const display = label ? (lang === "en" ? label.en : label.ja) : method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => togglePayment(method)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isOn ? "border-cyan-600 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-slate-50 text-slate-400 line-through"}`}
              >
                {display}
              </button>
            );
          })}
        </div>
      </section>

      {/* ━━━ 反映するボタン ━━━ */}
      <div className="flex flex-col items-center gap-3">
        {saved && <p className="text-sm font-medium text-emerald-600">{t("反映しました", "Applied")}</p>}
        <button
          type="button"
          onClick={handleApply}
          className="w-full rounded-full bg-cyan-500 px-6 py-4 text-sm font-bold text-white shadow transition hover:bg-cyan-400"
        >
          {t("反映する", "Apply")}
        </button>
      </div>
    </div>
  );
}

// ─── MetricCard サブコンポーネント ────────────────────────────────────────────

function MetricCard({
  label, formula, value, ideal, tone: t, missing, lang,
}: {
  label: string;
  formula: string;
  value: string;
  ideal: string;
  tone: "good" | "warn" | "bad";
  missing?: string;
  lang: "ja" | "en";
}) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClass(t)}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{label}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${toneClass(t)}`}>
          {toneBadge(t, lang)}
        </span>
      </div>
      <p className="mt-0.5 text-xs opacity-70">{formula}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-70">{lang === "en" ? "Target: " : "理想: "}{ideal}</p>
      {missing && (
        <p className="mt-2 rounded-xl bg-white/60 px-2 py-1 text-xs font-medium">{missing}</p>
      )}
    </div>
  );
}
