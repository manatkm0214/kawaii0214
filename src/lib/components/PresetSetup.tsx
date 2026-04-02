"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/utils"

interface Props {
  onComplete: (profile: Profile) => void
  initialProfile?: Profile | null
  onCancel?: () => void
  mode?: "create" | "edit"
}

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
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

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

  async function handleCreateProfile() {
    const normalizedTakeHome = Number(takeHome || 0)
    const normalizedSavingsGoal = Number(monthlySavingsGoal || 0)
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
      setFixedRate("35")
      setVariableRate("25")
      setSavingsRate("20")
      setCategoryAllocation({ "住居": "35", "食費": "20", "水道光熱": "10", "通信": "6", "交通": "8", "日用品": "8", "娯楽": "8", "教育": "3", "その他": "2" })
      return
    }
    if (name === "defense") {
      applyAccent("defense")
      setFixedRate("33")
      setVariableRate("20")
      setSavingsRate("30")
      setCategoryAllocation({ "住居": "38", "食費": "18", "水道光熱": "10", "通信": "6", "交通": "8", "日用品": "8", "娯楽": "5", "教育": "3", "その他": "4" })
      return
    }
    applyAccent("growth")
    setFixedRate("30")
    setVariableRate("25")
    setSavingsRate("30")
    setCategoryAllocation({ "住居": "32", "食費": "18", "水道光熱": "9", "通信": "6", "交通": "8", "日用品": "7", "娯楽": "10", "教育": "6", "その他": "4" })
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
        <p className="text-sm text-slate-400">表示名と手取りの目標配分を決めると、ダッシュボードにすぐ反映されます。</p>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
            message.type === "success"
              ? "bg-emerald-900/50 border border-emerald-700/60 text-emerald-200"
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

        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={takeHome}
          onChange={e => setTakeHome(e.target.value)}
          placeholder="今月の手取り（任意）"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
        />

        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={monthlySavingsGoal}
          onChange={e => setMonthlySavingsGoal(e.target.value)}
          placeholder="毎月の貯金目標（円）"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
        />

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => applyPreset("balanced")} className={`py-2 text-xs bg-slate-900 border rounded-xl ${accentPreset === "balanced" ? "border-violet-500 text-violet-300" : "border-slate-700 hover:border-violet-500"}`}>
            バランス
          </button>
          <button type="button" onClick={() => applyPreset("defense")} className={`py-2 text-xs bg-slate-900 border rounded-xl ${accentPreset === "defense" ? "border-emerald-500 text-emerald-300" : "border-slate-700 hover:border-emerald-500"}`}>
            守り重視
          </button>
          <button type="button" onClick={() => applyPreset("growth")} className={`py-2 text-xs bg-slate-900 border rounded-xl ${accentPreset === "growth" ? "border-amber-500 text-amber-300" : "border-slate-700 hover:border-amber-500"}`}>
            成長重視
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => applyAccent("balanced")} className={`py-2 text-xs rounded-xl border ${accentPreset === "balanced" ? "bg-violet-600/20 border-violet-500" : "bg-slate-900 border-slate-700"}`}>
            色:バランス
          </button>
          <button type="button" onClick={() => applyAccent("defense")} className={`py-2 text-xs rounded-xl border ${accentPreset === "defense" ? "bg-emerald-600/20 border-emerald-500" : "bg-slate-900 border-slate-700"}`}>
            色:守り
          </button>
          <button type="button" onClick={() => applyAccent("growth")} className={`py-2 text-xs rounded-xl border ${accentPreset === "growth" ? "bg-amber-600/20 border-amber-500" : "bg-slate-900 border-slate-700"}`}>
            色:成長
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
