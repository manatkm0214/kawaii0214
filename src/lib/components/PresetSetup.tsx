"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/utils"

interface Props {
  onComplete: (profile: Profile) => void
  initialProfile?: Profile | null
  onCancel?: () => void
  mode?: "create" | "edit"
}

const MONEY_UNITS = [
  { label: "円", factor: 1 },
  { label: "千円", factor: 1000 },
  { label: "万円", factor: 10000 },
] as const

export default function PresetSetup({ onComplete, initialProfile = null, onCancel, mode = "create" }: Props) {
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? "")
  const [takeHome, setTakeHome] = useState(() => {
    if (typeof initialProfile?.allocation_take_home === "number" && initialProfile.allocation_take_home > 0) {
      return String(initialProfile.allocation_take_home)
    }
    return ""
  })
  const [fixedRate, setFixedRate] = useState(String(initialProfile?.allocation_target_fixed_rate ?? 35))
  const [variableRate, setVariableRate] = useState(String(initialProfile?.allocation_target_variable_rate ?? 25))
  const [savingsRate, setSavingsRate] = useState(String(initialProfile?.allocation_target_savings_rate ?? 20))
  const [takeHomeUnit, setTakeHomeUnit] = useState(1)
  const [savingsGoalUnit, setSavingsGoalUnit] = useState(1)
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState(() => {
    if (typeof window === "undefined") return ""
    const raw = window.localStorage.getItem("kakeibo-savings-goal")
    const parsed = Number(raw || 0)
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : ""
  })
  const [categoryAllocation, setCategoryAllocation] = useState<Record<string, string>>({
    "住居": "35",
    "食費": "20",
    "水道光熱": "10",
    "通信": "6",
    "交通": "8",
    "日用品": "8",
    "娯楽": "8",
    "教育": "3",
    "その他": "2",
  })
  const [accentPreset, setAccentPreset] = useState<"balanced" | "defense" | "growth">(() => {
    if (typeof window === "undefined") return "balanced"
    const saved = window.localStorage.getItem("kakeibo-accent")
    return saved === "defense" || saved === "growth" || saved === "balanced" ? saved : "balanced"
  })
  const [monthlyBalanceLevel, setMonthlyBalanceLevel] = useState<"plus" | "zero" | "minus">("zero")
  const [bufferLevel, setBufferLevel] = useState<"low" | "mid" | "high">("mid")
  const [inflationPressure, setInflationPressure] = useState<"low" | "mid" | "high">("mid")
  const [diagnosisDetail, setDiagnosisDetail] = useState<{
    mode: "standard" | "inflation" | "deficit"
    total: number
    balanceScore: number
    bufferScore: number
    inflationScore: number
    reason: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

  useEffect(() => {
    const savedTakeHome = Number(takeHome || 0)
    if (savedTakeHome > 0 && takeHomeUnit === 1) {
      if (savedTakeHome >= 100000) {
        setTakeHomeUnit(10000)
        setTakeHome(String(Math.round((savedTakeHome / 10000) * 10) / 10))
      } else if (savedTakeHome >= 1000) {
        setTakeHomeUnit(1000)
        setTakeHome(String(Math.round((savedTakeHome / 1000) * 10) / 10))
      }
    }

    const savedGoal = Number(monthlySavingsGoal || 0)
    if (savedGoal > 0 && savingsGoalUnit === 1) {
      if (savedGoal >= 100000) {
        setSavingsGoalUnit(10000)
        setMonthlySavingsGoal(String(Math.round((savedGoal / 10000) * 10) / 10))
      } else if (savedGoal >= 1000) {
        setSavingsGoalUnit(1000)
        setMonthlySavingsGoal(String(Math.round((savedGoal / 1000) * 10) / 10))
      }
    }
    // 初回表示時のみ単位を補正
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const strategyLabel = useMemo(() => {
    if (accentPreset === "balanced") return "経済標準/バランス"
    if (accentPreset === "defense") return "物価高対策/守り重視"
    return "赤字改善/成長重視"
  }, [accentPreset])

  const rateTotal = useMemo(() => {
    return [fixedRate, variableRate, savingsRate].reduce((sum, value) => sum + Number(value || 0), 0)
  }, [fixedRate, savingsRate, variableRate])

  const categoryTotal = useMemo(() => {
    return Object.values(categoryAllocation).reduce((sum, value) => sum + Number(value || 0), 0)
  }, [categoryAllocation])

  function clampPercent(value: string): number {
    return Math.min(100, Math.max(0, Number(value || 0)))
  }

  function applyAccent(next: "balanced" | "defense" | "growth") {
    setAccentPreset(next)
    if (typeof window === "undefined") return
    window.localStorage.setItem("kakeibo-accent", next)
    document.documentElement.setAttribute("data-accent", next)
  }

  function switchTakeHomeUnit(nextUnit: number) {
    if (nextUnit === takeHomeUnit) return
    const raw = Number(takeHome || 0)
    if (!Number.isFinite(raw) || raw <= 0) {
      setTakeHomeUnit(nextUnit)
      return
    }
    const normalized = raw * takeHomeUnit
    const converted = normalized / nextUnit
    setTakeHome(String(Math.round(converted * 10) / 10))
    setTakeHomeUnit(nextUnit)
  }

  function switchSavingsGoalUnit(nextUnit: number) {
    if (nextUnit === savingsGoalUnit) return
    const raw = Number(monthlySavingsGoal || 0)
    if (!Number.isFinite(raw) || raw <= 0) {
      setSavingsGoalUnit(nextUnit)
      return
    }
    const normalized = raw * savingsGoalUnit
    const converted = normalized / nextUnit
    setMonthlySavingsGoal(String(Math.round(converted * 10) / 10))
    setSavingsGoalUnit(nextUnit)
  }

  async function handleCreateProfile() {
    const normalizedTakeHome = Number(takeHome || 0) * takeHomeUnit
    const normalizedSavingsGoal = Number(monthlySavingsGoal || 0) * savingsGoalUnit
    const allocationTargetFixedRate = clampPercent(fixedRate)
    const allocationTargetVariableRate = clampPercent(variableRate)
    const allocationTargetSavingsRate = clampPercent(savingsRate)

    setMessage(null)

    if (rateTotal > 100) {
      setMessage({ type: "error", text: "配分割合の合計は100%以下にしてください" })
      return
    }

    if (categoryTotal !== 100) {
      setMessage({ type: "error", text: "カテゴリ別配分の合計は100%にしてください" })
      return
    }

    if (takeHome && (!Number.isFinite(normalizedTakeHome) || normalizedTakeHome <= 0)) {
      setMessage({ type: "error", text: "手取りは1以上の数値で入力してください" })
      return
    }

    if (monthlySavingsGoal && (!Number.isFinite(normalizedSavingsGoal) || normalizedSavingsGoal < 0)) {
      setMessage({ type: "error", text: "貯金目標は0以上の数値で入力してください" })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        setMessage({ type: "error", text: "ユーザー情報を取得できませんでした。再ログインしてください" })
        return
      }

      const profilePayload = {
        id: authData.user.id,
        display_name: displayName.trim() || null,
        currency: "JPY",
        allocation_take_home: takeHome ? Math.round(normalizedTakeHome) : null,
        allocation_target_fixed_rate: allocationTargetFixedRate,
        allocation_target_variable_rate: allocationTargetVariableRate,
        allocation_target_savings_rate: allocationTargetSavingsRate,
      }

      const { data, error } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
        .select()
        .single()

      if (error) {
        setMessage({ type: "error", text: "プロフィール作成に失敗しました: " + error.message })
        return
      }

      // カテゴリ別配分を今月予算へ反映
      if (normalizedTakeHome > 0) {
        const month = new Date().toISOString().slice(0, 7)
        const expenseTarget = Math.max(0, Math.round((normalizedTakeHome * (allocationTargetFixedRate + allocationTargetVariableRate)) / 100))
        const budgetRows = Object.entries(categoryAllocation).map(([category, ratio]) => ({
          user_id: authData.user.id,
          category,
          month,
          amount: Math.max(1, Math.round((expenseTarget * Number(ratio || 0)) / 100)),
        }))

        const { error: budgetError } = await supabase
          .from("budgets")
          .upsert(budgetRows, { onConflict: "user_id,category,month" })

        if (budgetError) {
          setMessage({ type: "error", text: "カテゴリ予算の保存に失敗しました: " + budgetError.message })
          return
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("kakeibo-savings-goal", String(Math.round(normalizedSavingsGoal || 0)))
        window.localStorage.setItem("kakeibo-accent", accentPreset)
        document.documentElement.setAttribute("data-accent", accentPreset)
      }

      setMessage({ type: "success", text: "初期設定を保存しました" })
      onComplete(data)
    } finally {
      setLoading(false)
    }
  }

  function applyPreset(name: "balanced" | "defense" | "growth") {
    if (name === "balanced") {
      applyAccent("balanced")
      if (typeof window !== "undefined") {
        window.localStorage.setItem("kakeibo-strategy-mode", "standard")
      }
      setFixedRate("35")
      setVariableRate("25")
      setSavingsRate("20")
      setCategoryAllocation({ "住居": "35", "食費": "20", "水道光熱": "10", "通信": "6", "交通": "8", "日用品": "8", "娯楽": "8", "教育": "3", "その他": "2" })
      return
    }
    if (name === "defense") {
      applyAccent("defense")
      if (typeof window !== "undefined") {
        window.localStorage.setItem("kakeibo-strategy-mode", "inflation")
      }
      setFixedRate("33")
      setVariableRate("20")
      setSavingsRate("30")
      setCategoryAllocation({ "住居": "38", "食費": "18", "水道光熱": "10", "通信": "6", "交通": "8", "日用品": "8", "娯楽": "5", "教育": "3", "その他": "4" })
      return
    }
    applyAccent("growth")
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-strategy-mode", "deficit")
    }
    setFixedRate("30")
    setVariableRate("25")
    setSavingsRate("30")
    setCategoryAllocation({ "住居": "32", "食費": "18", "水道光熱": "9", "通信": "6", "交通": "8", "日用品": "7", "娯楽": "10", "教育": "6", "その他": "4" })
  }

  function applyCustomMode() {
    setDiagnosisDetail(null)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-strategy-mode", "custom")
    }
    setMessage({ type: "success", text: "カスタムモードを選択しました。下の配分を自由に調整して保存できます。" })
  }

  function autoSelectModeBy3Questions() {
    const deficitScore = monthlyBalanceLevel === "minus" ? 2 : monthlyBalanceLevel === "zero" ? 1 : 0
    const bufferScore = bufferLevel === "low" ? 2 : bufferLevel === "mid" ? 1 : 0
    const inflationScore = inflationPressure === "high" ? 2 : inflationPressure === "mid" ? 1 : 0
    const total = deficitScore + bufferScore + inflationScore

    if (monthlyBalanceLevel === "minus" || total >= 5) {
      applyPreset("growth")
      if (typeof window !== "undefined") {
        window.localStorage.setItem("kakeibo-strategy-mode", "deficit")
      }
      setDiagnosisDetail({
        mode: "deficit",
        total,
        balanceScore: deficitScore,
        bufferScore,
        inflationScore,
        reason: "赤字または高リスク判定（合計5点以上）のため、赤字改善を推奨",
      })
      setMessage({ type: "success", text: "診断結果: 赤字改善/成長重視 を自動選択しました。" })
      return
    }

    if (inflationPressure === "high" || total >= 3) {
      applyPreset("defense")
      if (typeof window !== "undefined") {
        window.localStorage.setItem("kakeibo-strategy-mode", "inflation")
      }
      setDiagnosisDetail({
        mode: "inflation",
        total,
        balanceScore: deficitScore,
        bufferScore,
        inflationScore,
        reason: "物価高圧力が高い、または中リスク判定（合計3点以上）のため、守り重視を推奨",
      })
      setMessage({ type: "success", text: "診断結果: 物価高対策/守り重視 を自動選択しました。" })
      return
    }

    applyPreset("balanced")
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-strategy-mode", "standard")
    }
    setDiagnosisDetail({
      mode: "standard",
      total,
      balanceScore: deficitScore,
      bufferScore,
      inflationScore,
      reason: "低リスク判定（合計2点以下）のため、経済標準を推奨",
    })
    setMessage({ type: "success", text: "診断結果: 経済標準/バランス を自動選択しました。" })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{mode === "edit" ? "初期設定を変更" : "はじめに設定"}</h2>
          {mode === "edit" && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
            >
              閉じる
            </button>
          )}
        </div>
        <p className="text-sm text-slate-400">最初に「配分プリセット」から目標を選択してください。選択内容は下の現在値に即時反映されます。</p>

        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-200">配分プリセット（まずここを選択）</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => applyPreset("balanced")} className={`py-2 text-[11px] bg-slate-900 border rounded-xl ${accentPreset === "balanced" ? "border-violet-500 text-violet-300" : "border-slate-700 hover:border-violet-500"}`}>
              経済標準/バランス
            </button>
            <button type="button" onClick={() => applyPreset("defense")} className={`py-2 text-[11px] bg-slate-900 border rounded-xl ${accentPreset === "defense" ? "border-emerald-500 text-emerald-300" : "border-slate-700 hover:border-emerald-500"}`}>
              物価高対策/守り重視
            </button>
            <button type="button" onClick={() => applyPreset("growth")} className={`py-2 text-[11px] bg-slate-900 border rounded-xl ${accentPreset === "growth" ? "border-amber-500 text-amber-300" : "border-slate-700 hover:border-amber-500"}`}>
              赤字改善/成長重視
            </button>
            <button type="button" onClick={applyCustomMode} className="py-2 text-[11px] bg-slate-900 border border-cyan-600 rounded-xl text-cyan-300 hover:border-cyan-400">
              カスタム（自由入力）
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            余裕あり: 経済標準/バランス ・ 余裕が薄い: 物価高対策/守り重視 ・ 余裕がない: 赤字改善/成長重視
          </p>
        </div>

        <div className="rounded-xl border border-violet-700/40 bg-violet-900/10 p-3 space-y-1">
          <p className="text-xs font-semibold text-violet-200">現在の配分目標</p>
          <p className="text-[11px] text-slate-300">選択モード: {strategyLabel}</p>
          <p className="text-[11px] text-slate-300">固定費 {fixedRate}% ・ 変動費 {variableRate}% ・ 貯蓄+投資 {savingsRate}%</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-300">質問3つで自動判定</p>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <label className="text-slate-400">
              1. 直近の月次収支は？
              <select
                value={monthlyBalanceLevel}
                onChange={(e) => setMonthlyBalanceLevel(e.target.value as "plus" | "zero" | "minus")}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2"
              >
                <option value="plus">黒字</option>
                <option value="zero">ほぼトントン</option>
                <option value="minus">赤字</option>
              </select>
            </label>
            <label className="text-slate-400">
              2. 生活防衛資金（現金）は？
              <select
                value={bufferLevel}
                onChange={(e) => setBufferLevel(e.target.value as "low" | "mid" | "high")}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2"
              >
                <option value="low">1か月未満</option>
                <option value="mid">1〜3か月</option>
                <option value="high">3か月以上</option>
              </select>
            </label>
            <label className="text-slate-400">
              3. 物価高の負担感は？
              <select
                value={inflationPressure}
                onChange={(e) => setInflationPressure(e.target.value as "low" | "mid" | "high")}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2"
              >
                <option value="low">低い</option>
                <option value="mid">やや高い</option>
                <option value="high">高い</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={autoSelectModeBy3Questions}
            className="w-full py-2 text-xs rounded-lg bg-blue-700 hover:bg-blue-600"
          >
            3問で最適モードを自動選択
          </button>

          <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-[11px] text-slate-300 space-y-1">
            <p className="font-semibold text-slate-200">点数基準（凡例）</p>
            <p>月次収支: 黒字 0点 / トントン 1点 / 赤字 2点</p>
            <p>防衛資金: 3か月以上 0点 / 1〜3か月 1点 / 1か月未満 2点</p>
            <p>物価高負担: 低い 0点 / やや高い 1点 / 高い 2点</p>
            <p>合計 0〜2点: 経済標準 / 3〜4点: 物価高対策 / 5〜6点: 赤字改善</p>
            <p>補足: 月次収支が赤字なら、合計点に関係なく赤字改善を優先します。</p>
          </div>

          {diagnosisDetail && (
            <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 p-3 text-xs text-blue-100 space-y-1">
              <p className="font-semibold">診断根拠（スコア内訳）</p>
              <p>月次収支: {diagnosisDetail.balanceScore}点 / 防衛資金: {diagnosisDetail.bufferScore}点 / 物価高負担: {diagnosisDetail.inflationScore}点</p>
              <p>合計: {diagnosisDetail.total}点</p>
              <p>判定: {diagnosisDetail.mode === "standard" ? "経済標準" : diagnosisDetail.mode === "inflation" ? "物価高対策" : "赤字改善"}</p>
              <p className="text-blue-200">理由: {diagnosisDetail.reason}</p>
            </div>
          )}
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
            message.type === "success"
              ? "bg-emerald-900/50 border border-emerald-700/60 text-emerald-200 animate-success-bounce"
              : "bg-red-900/50 border border-red-700/60 text-red-200"
          }`}>
            {message.text}
          </div>
        )}

        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="表示名（任意）"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
        />

        <div className="space-y-2">
          <p className="text-xs text-slate-400">今月の手取り（任意）</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={takeHome}
              onChange={e => setTakeHome(e.target.value)}
              placeholder="金額"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
            />
            <div className="flex gap-1">
              {MONEY_UNITS.map((u) => (
                <button
                  key={u.label}
                  type="button"
                  onClick={() => switchTakeHomeUnit(u.factor)}
                  className={`px-3 py-3 rounded-xl text-xs border transition-all ${
                    takeHomeUnit === u.factor
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-300"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-400">毎月の貯金目標</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={monthlySavingsGoal}
              onChange={e => setMonthlySavingsGoal(e.target.value)}
              placeholder="金額"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
            />
            <div className="flex gap-1">
              {MONEY_UNITS.map((u) => (
                <button
                  key={u.label}
                  type="button"
                  onClick={() => switchSavingsGoalUnit(u.factor)}
                  className={`px-3 py-3 rounded-xl text-xs border transition-all ${
                    savingsGoalUnit === u.factor
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-300"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => applyAccent("balanced")} className={`py-2 text-[11px] rounded-xl border ${accentPreset === "balanced" ? "bg-violet-600/20 border-violet-500" : "bg-slate-900 border-slate-700"}`}>
            色:経済標準
          </button>
          <button type="button" onClick={() => applyAccent("defense")} className={`py-2 text-[11px] rounded-xl border ${accentPreset === "defense" ? "bg-emerald-600/20 border-emerald-500" : "bg-slate-900 border-slate-700"}`}>
            色:物価高
          </button>
          <button type="button" onClick={() => applyAccent("growth")} className={`py-2 text-[11px] rounded-xl border ${accentPreset === "growth" ? "bg-amber-600/20 border-amber-500" : "bg-slate-900 border-slate-700"}`}>
            色:赤字改善
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-400">
            固定費
            <input
              type="number"
              min={0}
              max={100}
              value={fixedRate}
              onChange={e => setFixedRate(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            変動費
            <input
              type="number"
              min={0}
              max={100}
              value={variableRate}
              onChange={e => setVariableRate(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            貯蓄+投資
            <input
              type="number"
              min={0}
              max={100}
              value={savingsRate}
              onChange={e => setSavingsRate(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500"
            />
          </label>
        </div>

        <p className={`text-xs ${rateTotal > 100 ? "text-red-300" : "text-slate-400"}`}>
          配分合計: {rateTotal}%
        </p>

        <div className="space-y-2">
          <p className="text-xs text-slate-400">カテゴリ別配分（支出予算の内訳）</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(categoryAllocation).map(([category, ratio]) => (
              <label key={category} className="text-[11px] text-slate-400">
                {category}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={ratio}
                  onChange={e => setCategoryAllocation(prev => ({ ...prev, [category]: e.target.value }))}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-violet-500"
                />
              </label>
            ))}
          </div>
          <p className={`text-xs ${categoryTotal === 100 ? "text-slate-400" : "text-red-300"}`}>
            カテゴリ合計: {categoryTotal}%
          </p>
        </div>

        <button
          onClick={handleCreateProfile}
          disabled={loading || rateTotal > 100 || categoryTotal !== 100}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold"
        >
          {loading ? "保存中..." : mode === "edit" ? "変更を保存" : "開始する"}
        </button>
      </div>
    </div>
  )
}
