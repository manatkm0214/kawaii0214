"use client"

import { Transaction, Budget, Profile, formatCurrency } from "@/lib/utils"
import { useEffect, useMemo, useState } from "react"

const MONEY_UNITS = [
  { label: "円", factor: 1 },
  { label: "千円", factor: 1000 },
  { label: "万円", factor: 10000 },
] as const

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  currentMonth: string
  profile: Profile | null
  onOpenSetup?: () => void
}

function safeLevel(savingRate: number): { level: string; color: string; bar: number } {
  if (savingRate >= 30) return { level: "S", color: "text-emerald-400", bar: 100 }
  if (savingRate >= 20) return { level: "A", color: "text-green-400", bar: 80 }
  if (savingRate >= 10) return { level: "B", color: "text-yellow-400", bar: 60 }
  if (savingRate >= 5)  return { level: "C", color: "text-orange-400", bar: 40 }
  return { level: "D", color: "text-red-400", bar: 20 }
}

export default function Dashboard({ transactions, budgets, currentMonth, profile, onOpenSetup }: Props) {
  const [highlightAfterSave, setHighlightAfterSave] = useState(() => {
    if (typeof window === "undefined") return false
    return window.sessionStorage.getItem("kakeibo-just-saved") === "1"
  })
  const [monthlySavingsGoal] = useState(() => {
    if (typeof window === "undefined") return 0
    const raw = window.localStorage.getItem("kakeibo-savings-goal")
    const parsed = Number(raw || 0)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  })
  const [strategyMode, setStrategyMode] = useState<"standard" | "inflation" | "deficit" | "custom">(() => {
    if (typeof window === "undefined") return "standard"
    const saved = window.localStorage.getItem("kakeibo-strategy-mode")
    return saved === "inflation" || saved === "deficit" || saved === "custom" || saved === "standard"
      ? saved
      : "standard"
  })
  const [moneyUnit, setMoneyUnit] = useState<1 | 1000 | 10000>(() => {
    if (typeof window === "undefined") return 10000
    const raw = Number(window.localStorage.getItem("kakeibo-money-unit") || 10000)
    if (raw === 1 || raw === 1000 || raw === 10000) return raw
    return 10000
  })
  const [defenseBasis, setDefenseBasis] = useState<"expense" | "fixed">(() => {
    if (typeof window === "undefined") return "expense"
    const saved = window.localStorage.getItem("kakeibo-defense-basis")
    return saved === "fixed" ? "fixed" : "expense"
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("kakeibo-strategy-mode", strategyMode)
  }, [strategyMode])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("kakeibo-money-unit", String(moneyUnit))
  }, [moneyUnit])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("kakeibo-defense-basis", defenseBasis)
  }, [defenseBasis])

  useEffect(() => {
    if (typeof window === "undefined" || !highlightAfterSave) return
    window.sessionStorage.removeItem("kakeibo-just-saved")

    const timeoutId = window.setTimeout(() => {
      setHighlightAfterSave(false)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [highlightAfterSave])

  const stats = useMemo(() => {
    const monthly = transactions.filter(t => t.date.startsWith(currentMonth))
    const income = monthly.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = monthly.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const saving = monthly.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
    const investment = monthly.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
    const fixed = monthly.filter(t => t.is_fixed && t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const balance = income - expense - saving - investment
    const savingRate = income > 0 ? Math.round(((saving + investment) / income) * 100) : 0
    const fixedRate = expense > 0 ? Math.round((fixed / expense) * 100) : 0
    const wasteRate = income > 0 ? Math.round(((expense - fixed) / income) * 100) : 0
    const defenseFund = saving * 6

    // カテゴリ別支出
    const categoryMap: Record<string, number> = {}
    monthly.filter(t => t.type === "expense").forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] ?? 0) + t.amount
    })

    // 予算進捗
    const budgetProgress = budgets.filter(b => b.month === currentMonth).map(b => {
      const spent = monthly.filter(t => t.type === "expense" && t.category === b.category).reduce((s, t) => s + t.amount, 0)
      return { ...b, spent, pct: Math.round((spent / b.amount) * 100) }
    })

    return { income, expense, saving, investment, balance, savingRate, fixedRate, wasteRate, defenseFund, fixed, categoryMap, budgetProgress }
  }, [transactions, budgets, currentMonth])

  const forecast = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number)
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
    const daysInMonth = new Date(year, month, 0).getDate()
    const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth

    const projectedIncome = Math.round((stats.income / daysElapsed) * daysInMonth)
    const projectedExpense = Math.round((stats.expense / daysElapsed) * daysInMonth)
    const projectedSaving = Math.round((stats.saving / daysElapsed) * daysInMonth)
    const projectedInvestment = Math.round((stats.investment / daysElapsed) * daysInMonth)
    const projectedBalance = projectedIncome - projectedExpense - projectedSaving - projectedInvestment

    const recentMonths = Array.from({ length: 3 }).map((_, index) => {
      const d = new Date(year, month - 1 - index, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    })
    const targetMonths = isCurrentMonth ? recentMonths : [currentMonth, ...recentMonths.slice(0, 2)]

    const monthlyBalances = targetMonths.map((m) => {
      const monthly = transactions.filter((t) => t.date.startsWith(m))
      const income = monthly.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
      const expense = monthly.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      const saving = monthly.filter((t) => t.type === "saving").reduce((s, t) => s + t.amount, 0)
      const investment = monthly.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0)
      return income - expense - saving - investment
    }).filter((v) => Number.isFinite(v))

    const avgMonthlyBalance = monthlyBalances.length > 0
      ? Math.round(monthlyBalances.reduce((sum, value) => sum + value, 0) / monthlyBalances.length)
      : stats.balance

    return {
      daysElapsed,
      daysInMonth,
      projectedIncome,
      projectedExpense,
      projectedSaving,
      projectedInvestment,
      projectedBalance,
      avgMonthlyBalance,
      annualProjection: avgMonthlyBalance * 12,
    }
  }, [currentMonth, stats.balance, stats.expense, stats.income, stats.investment, stats.saving, transactions])

  const allocation = useMemo(() => {
    const takeHome = profile?.allocation_take_home && profile.allocation_take_home > 0
      ? profile.allocation_take_home
      : stats.income
    const targetFixed = profile?.allocation_target_fixed_rate ?? 35
    const targetVariable = profile?.allocation_target_variable_rate ?? 25
    const targetSavings = profile?.allocation_target_savings_rate ?? 20

    const actualFixed = takeHome > 0 ? Math.round((stats.fixed / takeHome) * 100) : 0
    const actualVariable = takeHome > 0 ? Math.round(((stats.expense - stats.fixed) / takeHome) * 100) : 0
    const actualSavings = takeHome > 0 ? Math.round(((stats.saving + stats.investment) / takeHome) * 100) : 0

    return {
      takeHome,
      fixed: { actual: actualFixed, target: targetFixed, ok: actualFixed <= targetFixed },
      variable: { actual: actualVariable, target: targetVariable, ok: actualVariable <= targetVariable },
      savings: { actual: actualSavings, target: targetSavings, ok: actualSavings >= targetSavings },
    }
  }, [profile, stats.expense, stats.fixed, stats.income, stats.investment, stats.saving])

  const budgetMonth = useMemo(() => {
    const inCurrent = budgets.some((b) => b.month === currentMonth)
    if (inCurrent) return currentMonth
    const sorted = [...budgets]
      .map((b) => b.month)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
    return sorted[0] ?? null
  }, [budgets, currentMonth])

  const categoryAllocationView = useMemo(() => {
    if (!budgetMonth) return [] as Array<{ category: string; targetAmount: number; targetPct: number; actualAmount: number; actualPct: number }>

    const targetBudgets = budgets.filter((b) => b.month === budgetMonth)
    const totalTarget = targetBudgets.reduce((sum, b) => sum + b.amount, 0)
    const actualExpenseTotal = stats.expense

    return targetBudgets
      .map((b) => {
        const actualAmount = stats.categoryMap[b.category] ?? 0
        return {
          category: b.category,
          targetAmount: b.amount,
          targetPct: totalTarget > 0 ? Math.round((b.amount / totalTarget) * 100) : 0,
          actualAmount,
          actualPct: actualExpenseTotal > 0 ? Math.round((actualAmount / actualExpenseTotal) * 100) : 0,
        }
      })
      .sort((a, b) => b.targetAmount - a.targetAmount)
  }, [budgetMonth, budgets, stats.categoryMap, stats.expense])

  const expenseTrend = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number)
    const recentMonths = Array.from({ length: 3 }).map((_, index) => {
      const d = new Date(year, month - 1 - index, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    })

    const monthlyExpenses = recentMonths.map((m) => {
      const monthly = transactions.filter((t) => t.date.startsWith(m) && t.type === "expense")
      return monthly.reduce((sum, t) => sum + t.amount, 0)
    })

    const current = monthlyExpenses[0] ?? 0
    const base = monthlyExpenses.slice(1)
    const baseAvg = base.length > 0
      ? base.reduce((sum, value) => sum + value, 0) / base.length
      : current

    const changeRate = baseAvg > 0 ? Math.round(((current - baseAvg) / baseAvg) * 100) : 0

    return {
      current,
      baseAvg: Math.round(baseAvg),
      changeRate,
      pressure: changeRate >= 5,
    }
  }, [currentMonth, transactions])

  const policyTargets = useMemo(() => {
    if (strategyMode === "custom") {
      const fixed = profile?.allocation_target_fixed_rate ?? 35
      const variable = profile?.allocation_target_variable_rate ?? 25
      const savings = profile?.allocation_target_savings_rate ?? 20
      return {
        title: "カスタムモード",
        fixed,
        variable,
        savings,
        notes: "あなたが設定した配分目標を基準に改善ナビを表示",
      }
    }
    if (strategyMode === "inflation") {
      return {
        title: "物価高対策モード",
        fixed: 33,
        variable: 22,
        savings: 25,
        notes: "生活必需を守りつつ、変動費を先に削減して実質可処分を守る配分",
      }
    }
    if (strategyMode === "deficit") {
      return {
        title: "赤字改善モード",
        fixed: 30,
        variable: 20,
        savings: 30,
        notes: "固定費の見直しを優先し、先取り貯蓄で赤字再発を防ぐ配分",
      }
    }
    return {
      title: "経済標準モード",
      fixed: 35,
      variable: 25,
      savings: 20,
      notes: "手取りの範囲で持続可能性を重視した標準配分",
    }
  }, [profile?.allocation_target_fixed_rate, profile?.allocation_target_savings_rate, profile?.allocation_target_variable_rate, strategyMode])

  const improvementNav = useMemo(() => {
    const actions: string[] = []

    if (allocation.fixed.actual > policyTargets.fixed) {
      actions.push(`固定費が目標を ${allocation.fixed.actual - policyTargets.fixed}% 超過。通信・保険・サブスクを固定費から優先見直し。`)
    }
    if (allocation.variable.actual > policyTargets.variable) {
      actions.push(`変動費が目標を ${allocation.variable.actual - policyTargets.variable}% 超過。食費・日用品は週予算上限を設定。`)
    }
    if (allocation.savings.actual < policyTargets.savings) {
      actions.push(`貯蓄+投資が目標を ${policyTargets.savings - allocation.savings.actual}% 下回り。給料日に先取り設定を増額。`)
    }
    if (stats.balance < 0) {
      actions.push(`今月は赤字 ${formatCurrency(Math.abs(stats.balance))}。来月まで固定費を少なくとも ${formatCurrency(Math.ceil(Math.abs(stats.balance) / 2))} 圧縮。`)
    }
    if (expenseTrend.pressure) {
      actions.push(`直近支出が平均比 +${expenseTrend.changeRate}%。物価高圧力あり。代替ブランド・まとめ買い・電力プラン見直しを実施。`)
    }

    if (actions.length === 0) {
      actions.push("配分は健全圏です。余剰分は防衛資金6か月分の積み増しを優先。")
    }

    return actions
  }, [allocation.fixed.actual, allocation.savings.actual, allocation.variable.actual, expenseTrend.changeRate, expenseTrend.pressure, policyTargets.fixed, policyTargets.savings, policyTargets.variable, stats.balance])

  const { level, color, bar } = safeLevel(stats.savingRate)

  const defenseMonthlyBase = defenseBasis === "fixed" && stats.fixed > 0 ? stats.fixed : stats.expense
  const defenseMinimum = Math.round(defenseMonthlyBase * 3)
  const defenseTarget = Math.round(defenseMonthlyBase * 6)
  const defenseShortfall = Math.max(0, defenseTarget - stats.defenseFund)
  const defenseProgress = defenseTarget > 0 ? Math.min(100, Math.round((stats.defenseFund / defenseTarget) * 100)) : 0

  function formatByUnit(value: number): string {
    const unitLabel = moneyUnit === 1 ? "円" : moneyUnit === 1000 ? "千円" : "万円"
    const scaled = value / moneyUnit
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1)
    return `${text}${unitLabel}`
  }

  const forecastSavings = useMemo(() => {
    const monthlySavingsActual = stats.saving + stats.investment
    const projectedMonthlySavings = forecast.projectedSaving + forecast.projectedInvestment
    const annualSavingsProjection = projectedMonthlySavings * 12
    const deficitRiskCount = [stats.balance, forecast.projectedBalance, forecast.avgMonthlyBalance].filter((v) => v < 0).length
    const deficitRisk = deficitRiskCount >= 2 ? "high" : deficitRiskCount === 1 ? "mid" : "low"

    return {
      monthlySavingsActual,
      projectedMonthlySavings,
      annualSavingsProjection,
      deficitRisk,
    }
  }, [forecast.avgMonthlyBalance, forecast.projectedBalance, forecast.projectedInvestment, forecast.projectedSaving, stats.balance, stats.investment, stats.saving])

  const defenseEtaMonths = useMemo(() => {
    if (defenseShortfall <= 0) return 0
    const monthlyBufferIncrease = Math.max(0, forecastSavings.projectedMonthlySavings)
    if (monthlyBufferIncrease <= 0) return null
    return Math.ceil(defenseShortfall / monthlyBufferIncrease)
  }, [defenseShortfall, forecastSavings.projectedMonthlySavings])

  const defenseEtaDateLabel = useMemo(() => {
    if (defenseEtaMonths == null || defenseEtaMonths <= 0) return null
    const base = new Date()
    const eta = new Date(base.getFullYear(), base.getMonth() + defenseEtaMonths, 1)
    return `${eta.getFullYear()}年${eta.getMonth() + 1}月`
  }, [defenseEtaMonths])

  const cards = [
    { label: "収入", value: stats.income, color: "from-emerald-500/20 to-emerald-600/5", text: "text-emerald-400" },
    { label: "支出", value: stats.expense, color: "from-red-500/20 to-red-600/5", text: "text-red-400" },
    { label: "貯金", value: stats.saving, color: "from-blue-500/20 to-blue-600/5", text: "text-blue-400" },
    { label: "収支", value: stats.balance, color: "from-violet-500/20 to-violet-600/5", text: stats.balance >= 0 ? "text-violet-400" : "text-red-400" },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-slate-200 font-semibold">初期設定・配分設定</p>
            <p className="text-xs text-slate-400 mt-1">
              目標配分: 固定費 {allocation.fixed.target}% / 変動費 {allocation.variable.target}% / 貯蓄+投資 {allocation.savings.target}%
            </p>
          </div>
          {onOpenSetup && (
            <button
              type="button"
              onClick={onOpenSetup}
              className="px-3 py-2 rounded-xl text-xs bg-violet-600 hover:bg-violet-500 text-white"
            >
              設定を開く
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">💴 手取り・貯金目標</h3>
          <div className="flex gap-1">
            {MONEY_UNITS.map((u) => (
              <button
                key={u.label}
                type="button"
                onClick={() => setMoneyUnit(u.factor as 1 | 1000 | 10000)}
                className={`px-2 py-1 rounded-lg text-[11px] border ${moneyUnit === u.factor ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-slate-400">手取り（設定値）</p>
            <p className="text-sm font-semibold text-slate-200">{formatByUnit(allocation.takeHome)}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-slate-400">毎月の貯金目標</p>
            <p className="text-sm font-semibold text-slate-200">{monthlySavingsGoal > 0 ? formatByUnit(monthlySavingsGoal) : "未設定"}</p>
          </div>
        </div>
      </div>

      {(stats.budgetProgress.length === 0 || !profile?.allocation_take_home) && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-2xl p-4">
          <p className="text-sm text-amber-200 font-semibold">初期設定が未完了です</p>
          <p className="text-xs text-amber-100/90 mt-1">
            配分プリセットとカテゴリ配分を設定すると、予算ボードに自動反映されます。
          </p>
          {onOpenSetup && (
            <button
              type="button"
              onClick={onOpenSetup}
              className="mt-3 px-3 py-2 rounded-xl text-xs bg-amber-600 hover:bg-amber-500 text-white"
            >
              初期設定を開く
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">📚 カテゴリ配分（目標 vs 実績）</h3>
          <span className="text-xs text-slate-500">{budgetMonth ? `${budgetMonth}基準` : "未設定"}</span>
        </div>

        {categoryAllocationView.length === 0 ? (
          <p className="text-xs text-slate-400">カテゴリ配分が未設定です。「設定を開く」から初期設定でカテゴリ配分を作成してください。</p>
        ) : (
          <div className="space-y-2">
            {categoryAllocationView.slice(0, 9).map((row) => {
              const diff = row.actualPct - row.targetPct
              const over = diff > 0
              return (
                <div key={row.category} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{row.category}</span>
                    <span className={over ? "text-orange-300" : "text-emerald-300"}>
                      目標 {row.targetPct}% / 実績 {row.actualPct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-1.5 bg-violet-500" style={{ width: `${Math.min(row.targetPct, 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    目標 {formatCurrency(row.targetAmount)} ・ 実績 {formatCurrency(row.actualAmount)}{over ? `（+${diff}%超過）` : ""}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 基本4指標 */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, index) => (
          <div
            key={c.label}
            className={`bg-linear-to-br ${c.color} border border-slate-700/50 rounded-2xl p-4 dashboard-reveal dashboard-delay-${Math.min(index + 1, 6)} ${highlightAfterSave ? "animate-success-bounce" : ""}`}
          >
            <p className="text-xs text-slate-400 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.text}`}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      {/* 生活安全レベル */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">生活安全レベル</span>
          <span className={`text-2xl font-black ${color}`}>{level}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${
              level === "S" ? "bg-emerald-400" : level === "A" ? "bg-green-400" : level === "B" ? "bg-yellow-400" : level === "C" ? "bg-orange-400" : "bg-red-400"
            }`}
            style={{ width: `${bar}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">貯蓄率 {stats.savingRate}% 目標: 20%以上</p>
      </div>

      {/* 目標達成ミニカード */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">🎯 目標達成状況（手取り基準）</h3>
          <span className="text-xs text-slate-500">手取り: {formatCurrency(allocation.takeHome)}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {[
            { label: "固定費", data: allocation.fixed },
            { label: "変動費", data: allocation.variable },
            { label: "貯蓄+投資", data: allocation.savings },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <p className="text-slate-400 mb-1">{item.label}</p>
              <p className={item.data.ok ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                実績 {item.data.actual}% / 目標 {item.data.target}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {monthlySavingsGoal > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-300">🏦 貯金目標</h3>
            <span className="text-xs text-slate-500">目標 {formatCurrency(monthlySavingsGoal)}</span>
          </div>
          <p className="text-sm text-slate-300 mb-2">
            実績 {formatCurrency(stats.saving + stats.investment)}
          </p>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-2 bg-blue-500"
              style={{ width: `${Math.min(100, Math.round(((stats.saving + stats.investment) / monthlySavingsGoal) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            達成率 {Math.min(999, Math.round(((stats.saving + stats.investment) / monthlySavingsGoal) * 100))}%
          </p>
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">🧭 改善ナビ（経済モード）</h3>
          <span className="text-xs text-slate-500">支出トレンド {expenseTrend.changeRate >= 0 ? `+${expenseTrend.changeRate}` : expenseTrend.changeRate}%</span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setStrategyMode("standard")}
            className={`text-[11px] py-2 rounded-lg border transition-all ${strategyMode === "standard" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
          >
            経済標準/バランス
          </button>
          <button
            type="button"
            onClick={() => setStrategyMode("inflation")}
            className={`text-[11px] py-2 rounded-lg border transition-all ${strategyMode === "inflation" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
          >
            物価高対策/守り重視
          </button>
          <button
            type="button"
            onClick={() => setStrategyMode("deficit")}
            className={`text-[11px] py-2 rounded-lg border transition-all ${strategyMode === "deficit" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
          >
            赤字改善/成長重視
          </button>
          <button
            type="button"
            onClick={() => setStrategyMode("custom")}
            className={`text-[11px] py-2 rounded-lg border transition-all ${strategyMode === "custom" ? "bg-cyan-700 border-cyan-500 text-white" : "border-slate-700 text-slate-300"}`}
          >
            カスタム
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          余裕ありは「経済標準」、余裕が薄いときは「物価高対策」、赤字が続くときは「赤字改善」。個別事情がある場合は「カスタム」。
        </p>

        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200">{policyTargets.title}</p>
          <p>目標配分: 固定費 {policyTargets.fixed}% / 変動費 {policyTargets.variable}% / 貯蓄+投資 {policyTargets.savings}%</p>
          <p className="text-slate-400">{policyTargets.notes}</p>
        </div>

        <div className="space-y-2">
          {improvementNav.map((action, index) => (
            <div key={action} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-300">
              <span className="text-slate-400 mr-2">{index + 1}.</span>
              {action}
            </div>
          ))}
        </div>

        <details className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-200">経済指標の説明資料</summary>
          <div className="mt-3 space-y-2 text-slate-300 leading-relaxed">
            <p><span className="font-semibold">CPI（消費者物価指数）</span>: 物価の平均的な上昇率。上がるほど同じ金額で買える量が減ります。</p>
            <p><span className="font-semibold">実質賃金</span>: 名目賃金から物価上昇分を差し引いた購買力。実質賃金が下がると生活は苦しくなります。</p>
            <p><span className="font-semibold">政策金利</span>: 借入金利や預金金利に影響。高金利局面では変動金利ローンやリボの負担が増えやすいです。</p>
            <p><span className="font-semibold">為替（円安）</span>: 輸入品やエネルギー価格に影響。円安が進むと食料・光熱費が上がりやすいです。</p>
            <p><span className="font-semibold">家計での使い方</span>: 物価高局面は「固定費の契約見直し」と「変動費の週予算化」を先に行い、余力を先取り貯蓄へ回すのが有効です。</p>
          </div>
        </details>
      </div>

      {/* 赤字アラートと将来予測 */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">🔮 赤字・将来予測</h3>

        <div className={`rounded-xl border p-3 ${stats.balance < 0 ? "border-red-500/40 bg-red-900/20" : "border-emerald-500/30 bg-emerald-900/20"}`}>
          <p className="text-xs text-slate-300 mb-1">今月の実績判定</p>
          <p className={`text-sm font-semibold ${stats.balance < 0 ? "text-red-300" : "text-emerald-300"}`}>
            {stats.balance < 0 ? `赤字です（${formatCurrency(Math.abs(stats.balance))}）` : `黒字です（${formatCurrency(stats.balance)}）`}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${forecast.projectedBalance < 0 ? "border-red-500/40 bg-red-900/20" : "border-blue-500/30 bg-blue-900/20"}`}>
          <p className="text-xs text-slate-300 mb-1">月末見込み（現在ペース）</p>
          <p className={`text-sm font-semibold ${forecast.projectedBalance < 0 ? "text-red-300" : "text-blue-300"}`}>
            {forecast.projectedBalance < 0
              ? `月末は赤字見込み ${formatCurrency(Math.abs(forecast.projectedBalance))}`
              : `月末は黒字見込み ${formatCurrency(forecast.projectedBalance)}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            進捗 {forecast.daysElapsed}/{forecast.daysInMonth}日 | 収入見込み {formatCurrency(forecast.projectedIncome)} | 支出見込み {formatCurrency(forecast.projectedExpense)}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${forecast.annualProjection < 0 ? "border-red-500/40 bg-red-900/20" : "border-violet-500/30 bg-violet-900/20"}`}>
          <p className="text-xs text-slate-300 mb-1">12か月予測（直近3か月平均ベース）</p>
          <p className={`text-sm font-semibold ${forecast.annualProjection < 0 ? "text-red-300" : "text-violet-300"}`}>
            {forecast.annualProjection < 0
              ? `年間で赤字見込み ${formatCurrency(Math.abs(forecast.annualProjection))}`
              : `年間で黒字見込み ${formatCurrency(forecast.annualProjection)}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">平均月次収支: {formatCurrency(forecast.avgMonthlyBalance)}</p>
        </div>

        <div className={`rounded-xl border p-3 ${forecastSavings.annualSavingsProjection <= 0 ? "border-red-500/40 bg-red-900/20" : "border-sky-500/30 bg-sky-900/20"}`}>
          <p className="text-xs text-slate-300 mb-1">将来貯金予測</p>
          <p className={`text-sm font-semibold ${forecastSavings.annualSavingsProjection <= 0 ? "text-red-300" : "text-sky-300"}`}>
            12か月の貯金+投資見込み {formatCurrency(forecastSavings.annualSavingsProjection)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            今月実績 {formatCurrency(forecastSavings.monthlySavingsActual)} / 月末見込み {formatCurrency(forecastSavings.projectedMonthlySavings)}
          </p>
          <p className={`text-xs mt-1 ${forecastSavings.deficitRisk === "high" ? "text-red-300" : forecastSavings.deficitRisk === "mid" ? "text-amber-300" : "text-emerald-300"}`}>
            赤字リスク判定: {forecastSavings.deficitRisk === "high" ? "高" : forecastSavings.deficitRisk === "mid" ? "中" : "低"}
          </p>
        </div>
      </div>

      {/* 詳細指標 */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">詳細指標</h3>
        {[
          { label: "貯蓄率", value: `${stats.savingRate}%`, good: stats.savingRate >= 20, benchmark: "目安: 20%以上" },
          { label: "固定費率", value: `${stats.fixedRate}%`, good: stats.fixedRate <= 50, benchmark: "目安: 50%以下" },
          { label: "浪費率", value: `${stats.wasteRate}%`, good: stats.wasteRate <= 30, benchmark: "目安: 30%以下" },
          { label: "防衛資金（見込み）", value: formatCurrency(stats.defenseFund), good: stats.defenseFund >= defenseMinimum, benchmark: `目安: ${formatCurrency(defenseMinimum)}〜${formatCurrency(defenseTarget)}` },
          { label: "固定費合計", value: formatCurrency(stats.fixed), good: true, benchmark: "目安: 前月比で維持・微減" },
          { label: "投資額", value: formatCurrency(stats.investment), good: true, benchmark: "目安: 収入の10〜20%" },
        ].map(item => (
          <div key={item.label} className="flex justify-between items-start gap-3">
            <div>
              <span className="text-xs text-slate-300">{item.label}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.benchmark}</p>
            </div>
            <span className={`text-sm font-semibold ${item.good ? "text-slate-200" : "text-orange-400"}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">🛡 防衛資金目安</h3>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setDefenseBasis("expense")}
              className={`px-2 py-1 rounded-lg text-[11px] border ${defenseBasis === "expense" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
            >
              総支出基準
            </button>
            <button
              type="button"
              onClick={() => setDefenseBasis("fixed")}
              className={`px-2 py-1 rounded-lg text-[11px] border ${defenseBasis === "fixed" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
            >
              固定費基準
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          目安: {defenseBasis === "expense" ? "総支出" : "固定費"}の3〜6か月分（最低 {formatCurrency(defenseMinimum)} / 推奨 {formatCurrency(defenseTarget)}）
        </p>
        <p className={`text-sm font-semibold ${defenseShortfall > 0 ? "text-amber-300" : "text-emerald-300"}`}>
          現在 {formatCurrency(stats.defenseFund)} / 不足 {formatCurrency(defenseShortfall)}
        </p>
        <p className="text-xs text-slate-400">
          到達見込み: {defenseEtaMonths === 0 ? "達成済み" : defenseEtaMonths == null ? "算出不可（貯金ペース0以下）" : `約${defenseEtaMonths}か月（${defenseEtaDateLabel}）`}
        </p>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-2 ${defenseProgress >= 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${defenseProgress}%` }} />
        </div>
      </div>

      {/* 予算進捗 */}
      {stats.budgetProgress.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">予算進捗</h3>
          {stats.budgetProgress.map(b => (
            <div key={b.id}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{b.category}</span>
                <span className={b.pct >= 100 ? "text-red-400 font-bold" : b.pct >= 80 ? "text-orange-400" : "text-slate-300"}>
                  {formatCurrency(b.spent)} / {formatCurrency(b.amount)} ({b.pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full">
                <div
                  className={`h-1.5 rounded-full ${b.pct >= 100 ? "bg-red-500" : b.pct >= 80 ? "bg-orange-400" : "bg-violet-500"}`}
                  style={{ width: `${Math.min(b.pct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
