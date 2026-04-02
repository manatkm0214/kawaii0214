"use client"

import { Transaction, formatCurrency } from "@/lib/utils"
import { useState, useMemo } from "react"

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

interface AnalysisResult {
  summary: string
  positives: string[]
  warnings: string[]
  actions: string[]
}

interface SavingsPlan {
  fixed_savings: string[]
  variable_savings: string[]
  income_boost: string[]
  monthly_save: string
  summary: string
}

export default function AIAnalysis({ transactions, currentMonth }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [savingsPlan, setSavingsPlan] = useState<SavingsPlan | null>(null)
  const [goal, setGoal] = useState("")
  const [loading, setLoading] = useState(false)
  const [savingLoading, setSavingLoading] = useState(false)

  const stats = useMemo(() => {
    const monthly = transactions.filter(t => t.date.startsWith(currentMonth))
    const income = monthly.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = monthly.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const saving = monthly.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
    const investment = monthly.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
    const fixed = monthly.filter(t => t.is_fixed).reduce((s, t) => s + t.amount, 0)
    const variable = expense - fixed
    const savingRate = income > 0 ? Math.round(((saving + investment) / income) * 100) : 0
    const fixedRate = expense > 0 ? Math.round((fixed / expense) * 100) : 0
    const catMap: Record<string, number> = {}
    monthly.filter(t => t.type === "expense").forEach(t => {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount
    })
    return { income, expense, saving, investment, fixed, variable, savingRate, fixedRate, categoryExpenses: catMap }
  }, [transactions, currentMonth])

  async function runAnalysis() {
    setLoading(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "analysis", data: stats }),
      })
      const { result } = await res.json()
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim())
      setAnalysis(parsed)
    } catch {
      alert("分析に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function runSavingsPlan() {
    if (!goal) { alert("目標を入力してください"); return }
    setSavingLoading(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "savings_plan",
          data: { goal, income: stats.income, fixedExpenses: stats.fixed, variableExpenses: stats.variable },
        }),
      })
      const { result } = await res.json()
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim())
      setSavingsPlan(parsed)
    } catch {
      alert("プラン生成に失敗しました")
    } finally {
      setSavingLoading(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 今月分析 */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">🤖 今月のAI分析</h3>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-xs font-medium transition-all"
          >
            {loading ? "分析中..." : "分析する"}
          </button>
        </div>

        {/* 今月サマリ */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="bg-slate-900/50 rounded-lg p-2">
            <p className="text-slate-500">貯蓄率</p>
            <p className="text-lg font-bold text-violet-400">{stats.savingRate}%</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2">
            <p className="text-slate-500">固定費率</p>
            <p className="text-lg font-bold text-orange-400">{stats.fixedRate}%</p>
          </div>
        </div>

        {analysis && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
            <div>
              <p className="text-xs font-semibold text-emerald-400 mb-1">✅ 良い点</p>
              {analysis.positives.map((p, i) => (
                <p key={i} className="text-xs text-slate-400 ml-2">・{p}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-400 mb-1">⚠️ 注意点</p>
              {analysis.warnings.map((w, i) => (
                <p key={i} className="text-xs text-slate-400 ml-2">・{w}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-400 mb-1">🎯 来月のアクション</p>
              {analysis.actions.map((a, i) => (
                <p key={i} className="text-xs text-slate-400 ml-2">{i + 1}. {a}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI節約プラン */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">💡 AI節約プラン</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="目標（例：毎月+1万円貯金したい）"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={runSavingsPlan}
            disabled={savingLoading}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-xl text-xs font-medium transition-all"
          >
            {savingLoading ? "生成中..." : "プラン生成"}
          </button>
        </div>

        {savingsPlan && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-400">月間節約見込み</p>
              <p className="text-xl font-bold text-emerald-300">{formatCurrency(Number(savingsPlan.monthly_save))}</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{savingsPlan.summary}</p>
            {[
              { title: "🏠 固定費削減", items: savingsPlan.fixed_savings, color: "text-blue-400" },
              { title: "🛍️ 変動費削減", items: savingsPlan.variable_savings, color: "text-yellow-400" },
              { title: "💼 収入アップ", items: savingsPlan.income_boost, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.title}>
                <p className={`text-xs font-semibold ${s.color} mb-1`}>{s.title}</p>
                {s.items.map((item, i) => (
                  <p key={i} className="text-xs text-slate-400 ml-2">・{item}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
