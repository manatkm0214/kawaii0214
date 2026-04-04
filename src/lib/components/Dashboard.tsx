
"use client"

import { Transaction, Budget, Profile, formatCurrency } from "@/lib/utils"
import { useEffect, useMemo, useState } from "react"

const MONEY_UNITS = [
  { label: "円", factor: 1 },
  { label: "千円", factor: 1000 },
  { label: "万円", factor: 10000 },
] as const
// --- ここから下をDashboard関数内に移動 ---

export default function Dashboard({ transactions, budgets, currentMonth, profile, onOpenSetup }: {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  profile: Profile | null;
  onOpenSetup?: () => void;
}) {
  // --- 先にユーティリティ関数を宣言 ---
  function readSavingsGoalFromStorage(): number {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem("kakeibo-savings-goal");
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  // ステート
  // 型パラメータをas構文に変更（JSXパースエラー回避）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mascotType, setMascotType] = useState("coin" as 'coin' | 'girl' | 'boy')
  const [highlightAfterSave, setHighlightAfterSave] = useState(() => {
    if (typeof window === "undefined") return false
    return window.sessionStorage.getItem("kakeibo-just-saved") === "1"
  })
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState(() => readSavingsGoalFromStorage())
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

  // 副作用
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
    if (typeof window === "undefined") return
    const syncSavingsGoal = () => {
      setMonthlySavingsGoal(readSavingsGoalFromStorage())
    }
    syncSavingsGoal()
    window.addEventListener("storage", syncSavingsGoal)
    window.addEventListener("kakeibo-goals-updated", syncSavingsGoal as EventListener)
    window.addEventListener("focus", syncSavingsGoal)
    return () => {
      window.removeEventListener("storage", syncSavingsGoal)
      window.removeEventListener("kakeibo-goals-updated", syncSavingsGoal as EventListener)
      window.removeEventListener("focus", syncSavingsGoal)
    }
  }, [])
  useEffect(() => {
    if (typeof window === "undefined" || !highlightAfterSave) return
    window.sessionStorage.removeItem("kakeibo-just-saved")
    const timeoutId = window.setTimeout(() => {
      setHighlightAfterSave(false)
    }, 500)
    return () => window.clearTimeout(timeoutId)
  }, [highlightAfterSave])


  // ...既存のuseMemo, ロジック, JSX return ここに続く...

  // --- 既存のuseMemo, JSX, returnはこの下に ---

    // --- ここからロジック ---
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
      const reserveStock = transactions
        .filter((t) => t.type === "saving" || t.type === "investment")
        .reduce((sum, t) => sum + t.amount, 0)

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

      return { income, expense, saving, investment, balance, savingRate, fixedRate, wasteRate, reserveStock, fixed, categoryMap, budgetProgress }
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


    // 予算月
    const budgetMonth = useMemo(() => {
      const inCurrent = budgets.some((b) => b.month === currentMonth)
      if (inCurrent) return currentMonth
      const sorted = [...budgets]
        .map((b) => b.month)
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))
      return sorted[0] ?? null
    }, [budgets, currentMonth])

    // カテゴリ配分
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

    // 支出傾向
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
        : 0

      const changeRate = baseAvg > 0 ? Math.round(((current - baseAvg) / baseAvg) * 100) : 0
      const pressure = changeRate > 10

      return { changeRate, pressure }
    }, [currentMonth, transactions])

    // ポリシー目標
    const policyTargets = useMemo(() => {
      if (strategyMode === "custom" && profile) {
        return {
          title: "カスタムモード",
          fixed: profile.allocation_target_fixed_rate ?? 35,
          variable: profile.allocation_target_variable_rate ?? 25,
          savings: profile.allocation_target_savings_rate ?? 20,
          notes: "手取りの範囲で持続可能性を重視した標準配分",
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
        notes: "あなたが設定した配分目標を基準に改善ナビを表示",
      }
    }, [profile, strategyMode])

    // 改善ナビ
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



  // 貯蓄率からレベル・色・バー値を返すユーティリティ
  function safeLevel(savingRate: number) {
    let level = "D";
    let color = "text-red-400";
    const bar = Math.max(0, Math.min(100, savingRate));
    if (savingRate >= 30) {
      level = "S";
      color = "text-emerald-400";
    } else if (savingRate >= 20) {
      level = "A";
      color = "text-green-400";
    } else if (savingRate >= 10) {
      level = "B";
      color = "text-yellow-400";
    } else if (savingRate >= 5) {
      level = "C";
      color = "text-orange-400";
    }
    return { level, color, bar };
  }

  const { level, color, bar } = safeLevel(stats.savingRate);

  const defenseFund = useMemo(() => {
    if (stats.reserveStock > 0) return stats.reserveStock
    if (monthlySavingsGoal > 0) return monthlySavingsGoal
    return stats.saving + stats.investment
  }, [monthlySavingsGoal, stats.investment, stats.reserveStock, stats.saving])

  const expenseBaseline = useMemo(() => {
    if (stats.expense > 0) return stats.expense

    const [year, month] = currentMonth.split("-").map(Number)
    const months = Array.from({ length: 3 }).map((_, index) => {
      const d = new Date(year, month - 1 - index, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    })

    const history = months
      .map((m) => transactions
        .filter((t) => t.type === "expense" && t.date.startsWith(m))
        .reduce((sum, t) => sum + t.amount, 0)
      )
      .filter((v) => v > 0)

    if (history.length > 0) {
      return Math.round(history.reduce((sum, v) => sum + v, 0) / history.length)
    }

    if ((profile?.allocation_take_home ?? 0) > 0) {
      return Math.round((profile!.allocation_take_home as number) * 0.6)
    }

    return 100000
  }, [currentMonth, profile, stats.expense, transactions])

  const defenseMonthlyBase = defenseBasis === "fixed"
    ? (stats.fixed > 0 ? stats.fixed : Math.round(expenseBaseline * 0.5))
    : expenseBaseline
  const defenseMinimum = Math.round(defenseMonthlyBase * 3)
  const defenseTarget = Math.round(defenseMonthlyBase * 6)
  const defenseShortfall = Math.max(0, defenseTarget - defenseFund)
  const defenseProgress = defenseTarget > 0 ? Math.min(100, Math.round((defenseFund / defenseTarget) * 100)) : 0

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
    <div className="w-full">

      {/* 初期設定未完了バナー */}
        {/* 初期設定未完了バナー（ゲストログインは非表示に変更） */}
        {/* ゲストログインバナーは非表示にしました */}
        {(stats.budgetProgress.length === 0 || !profile?.allocation_take_home) && (
          <div className="mb-2 bg-amber-950 border border-amber-500/70 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100 border border-amber-400/30 shrink-0">要設定</span>
              <p className="text-xs text-amber-100 truncate">手取り・配分目標・カテゴリ配分が未設定です。設定を保存するとすぐ反映されます。</p>
            </div>
            {onOpenSetup && (
              <button
                type="button"
                onClick={onOpenSetup}
                className="px-3 py-1.5 rounded-lg text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold shrink-0"
              >
                初期設定
              </button>
            )}
          </div>
        )}

      {/* 目標配分サマリ（スマホでも表示） */}
      <div className="mb-2 px-1 text-xs text-slate-400">
        目標配分: 固定費 {allocation.fixed.target}% / 変動費 {allocation.variable.target}% / 貯蓄+投資 {allocation.savings.target}%
      </div>

      {/* ─── レスポンシブ3カラムグリッド ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* ══════════════════════════════
            左カラム：サマリー
        ══════════════════════════════ */}
        <div className="flex flex-col gap-2">

          {/* 手取り・貯金目標 */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-slate-300">💴 手取り・貯金目標</h3>
              <div className="flex gap-1">
                {MONEY_UNITS.map((u) => (
                  <button
                    key={u.label}
                    type="button"
                    onClick={() => setMoneyUnit(u.factor as 1 | 1000 | 10000)}
                    className={`px-2 py-0.5 rounded text-[10px] border ${moneyUnit === u.factor ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">手取り</p>
                <p className="text-lg font-extrabold text-emerald-300">{formatByUnit(allocation.takeHome)}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">月次貯金目標</p>
                <p className="text-lg font-extrabold text-blue-300">{monthlySavingsGoal > 0 ? formatByUnit(monthlySavingsGoal) : "未設定"}</p>
              </div>
            </div>
          </div>

          {/* 今月の予算進捗サマリー（常時表示） */}
          {stats.budgetProgress.length > 0 && (
            <div className="bg-violet-900/40 border border-violet-500/40 rounded-xl p-2 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-violet-300 font-bold">今月の予算進捗</span>
                <span className="text-violet-100 font-bold text-lg">
                  {Math.round(stats.budgetProgress.reduce((a,b)=>a+b.pct,0)/stats.budgetProgress.length)}%
                </span>
              </div>
              <div className="h-3 bg-violet-700 rounded-full overflow-hidden">
                <div
                  className="h-3 bg-violet-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(stats.budgetProgress.reduce((a,b)=>a+b.pct,0)/stats.budgetProgress.length))}%` }}
                />
              </div>
            </div>
          )}

          {/* 基本4指標 */}
          <div className="grid grid-cols-2 gap-2">
            {cards.map((c, index) => (
              <div
                key={c.label}
                className={`bg-linear-to-br ${c.color} border border-slate-700/50 rounded-xl p-2 dashboard-reveal dashboard-delay-${Math.min(index + 1, 6)} ${highlightAfterSave ? "animate-success-bounce" : ""}`}
              >
                <p className="text-[10px] text-slate-400 mb-0.5">{c.label}</p>
                <p className={`text-base font-bold ${c.text}`}>{formatCurrency(c.value)}</p>
              </div>
            ))}
          </div>

          {/* 生活安全レベル */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">生活安全レベル</span>
              <span className={`text-xl font-black ${color}`}>{level}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  level === "S" ? "bg-emerald-400" : level === "A" ? "bg-green-400" : level === "B" ? "bg-yellow-400" : level === "C" ? "bg-orange-400" : "bg-red-400"
                }`}
                style={{ width: `${bar}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">貯蓄率 {stats.savingRate}% 目標: 20%以上</p>
            <details className="mt-1">
              <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300">レベルの見方 ▾</summary>
              <div className="mt-1 space-y-0.5 text-[10px]">
                {[
                  { lv: "S", range: "貯蓄率30%以上", desc: "優秀。防衛資金・資産形成も加速中", color: "text-emerald-400" },
                  { lv: "A", range: "貯蓄率20〜29%", desc: "良好。目標達成圏、継続が鍵", color: "text-green-400" },
                  { lv: "B", range: "貯蓄率10〜19%", desc: "標準。先取り額の増額を検討", color: "text-yellow-400" },
                  { lv: "C", range: "貯蓄率5〜9%", desc: "要注意。固定費・変動費の見直しを", color: "text-orange-400" },
                  { lv: "D", range: "貯蓄率5%未満", desc: "危険域。赤字改善モードで立て直しを", color: "text-red-400" },
                ].map(item => (
                  <div key={item.lv} className="flex items-start gap-1.5 rounded bg-slate-900/40 px-1.5 py-1">
                    <span className={`font-black shrink-0 ${item.color}`}>{item.lv}</span>
                    <div>
                      <span className="text-slate-300">{item.range}</span>
                      <span className="text-slate-500 ml-1">— {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* 目標達成状況 */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-slate-300">🎯 目標達成（手取り基準）</h3>
              <span className="text-[10px] text-slate-500">{formatCurrency(allocation.takeHome)}</span>
            </div>
            <div className="flex flex-col gap-1">
              {[
                { label: "固定費", data: allocation.fixed },
                { label: "変動費", data: allocation.variable },
                { label: "貯蓄+投資", data: allocation.savings },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1">
                  <span className="text-slate-400">{item.label}</span>
                  <span className={item.data.ok ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                    {item.data.actual}% / 目標 {item.data.target}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 貯金目標進捗（条件付き） */}
          {monthlySavingsGoal > 0 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-slate-300">🏦 月次貯金目標</h3>
                <span className="text-[10px] text-slate-500">目標 {formatCurrency(monthlySavingsGoal)}</span>
              </div>
              <div className="flex items-end justify-between mb-1">
                <p className="text-sm text-slate-300">実績 <span className="text-blue-400 font-bold">{formatCurrency(stats.saving + stats.investment)}</span></p>
                <span className={`text-xl font-black ${(stats.saving + stats.investment) >= monthlySavingsGoal ? "text-emerald-400" : "text-blue-400"}`}>
                  {Math.min(999, Math.round(((stats.saving + stats.investment) / monthlySavingsGoal) * 100))}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${(stats.saving + stats.investment) >= monthlySavingsGoal ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(100, Math.round(((stats.saving + stats.investment) / monthlySavingsGoal) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {(stats.saving + stats.investment) >= monthlySavingsGoal
                  ? "🎉 目標達成！"
                  : `あと ${formatCurrency(monthlySavingsGoal - stats.saving - stats.investment)}`}
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════
            中カラム：予算・配分
        ══════════════════════════════ */}
        <div className="flex flex-col gap-2">

          {/* カテゴリ配分 */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-slate-300">📚 カテゴリ配分（目標 vs 実績）</h3>
              <span className="text-[10px] text-slate-500">{budgetMonth ? `${budgetMonth}基準` : "未設定"}</span>
            </div>
            {categoryAllocationView.length === 0 ? (
              <p className="text-xs text-slate-400">カテゴリ配分が未設定です。初期設定でカテゴリ配分を作成してください。</p>
            ) : (
              <div className="space-y-1">
                {categoryAllocationView.slice(0, 9).map((row) => {
                  let takeHomeTarget = null
                  if (allocation.takeHome > 0) {
                    const parentType = row.category.match(/(食費|住居|水道光熱|通信|交通|医療|日用品|娯楽|教育)/)
                      ? "variable"
                      : row.category.match(/(保険|家賃|住宅ローン|サブスク|税金|年会費)/)
                      ? "fixed"
                      : null
                    if (row.category.includes("固定")) {
                      takeHomeTarget = Math.round(allocation.takeHome * allocation.fixed.target / 100)
                    } else if (row.category.includes("変動")) {
                      takeHomeTarget = Math.round(allocation.takeHome * allocation.variable.target / 100)
                    } else if (row.category.includes("貯") || row.category.includes("投資")) {
                      takeHomeTarget = Math.round(allocation.takeHome * allocation.savings.target / 100)
                    } else if (parentType === "variable") {
                      const variableTotal = categoryAllocationView
                        .filter(r => r.category.match(/(食費|住居|水道光熱|通信|交通|医療|日用品|娯楽|教育)/))
                        .reduce((sum, r) => sum + r.targetAmount, 0)
                      const pct = variableTotal > 0 ? row.targetAmount / variableTotal : 0
                      takeHomeTarget = Math.round(allocation.takeHome * allocation.variable.target / 100 * pct)
                    } else if (parentType === "fixed") {
                      const fixedTotal = categoryAllocationView
                        .filter(r => r.category.match(/(保険|家賃|住宅ローン|サブスク|税金|年会費)/))
                        .reduce((sum, r) => sum + r.targetAmount, 0)
                      const pct = fixedTotal > 0 ? row.targetAmount / fixedTotal : 0
                      takeHomeTarget = Math.round(allocation.takeHome * allocation.fixed.target / 100 * pct)
                    } else {
                      takeHomeTarget = Math.round(allocation.takeHome * (row.targetPct / 100))
                    }
                  }
                  return (
                    <div key={row.category} className="rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold">{row.category}</span>
                        <span className="text-emerald-300 font-semibold">目標 {formatCurrency(row.targetAmount)}</span>
                      </div>
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-1 bg-violet-500" style={{ width: `${Math.min(row.targetPct, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {takeHomeTarget !== null && (
                          <span className="text-slate-500">手取り基準: {formatCurrency(takeHomeTarget)}　</span>
                        )}
                        実績 <span className="text-white font-bold">{formatCurrency(row.actualAmount)}</span>
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 詳細指標（カスタム） */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
            <h3 className="text-xs font-semibold text-slate-300 mb-1">詳細指標</h3>
            <div className="space-y-1">
              {/* 予算進捗 */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-300">予算進捗</span>
                  <span className="text-slate-600 ml-1.5">{stats.budgetProgress && stats.budgetProgress.length > 0 ? `平均${Math.round(stats.budgetProgress.reduce((a,b)=>a+b.pct,0)/stats.budgetProgress.length)}%` : "-"}</span>
                </div>
                <span className="font-semibold shrink-0 text-slate-200">
                  {stats.budgetProgress && stats.budgetProgress.length > 0 ? `${Math.round(stats.budgetProgress.reduce((a,b)=>a+b.pct,0)/stats.budgetProgress.length)}%` : "-"}
                </span>
              </div>
              {/* 生活防衛資金（月数） */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-300">生活防衛（月数）</span>
                  <span className="text-slate-600 ml-1.5">目安 3〜6ヶ月</span>
                </div>
                <span className={`font-semibold shrink-0 ${defenseFund / (stats.expense / 12) >= 3 ? "text-slate-200" : "text-orange-400"}`}>
                  {stats.expense > 0 ? (defenseFund / (stats.expense / 12)).toFixed(1) : "-"}
                </span>
              </div>
              {/* 時給換算 */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-300">時給換算</span>
                  <span className="text-slate-600 ml-1.5">収入÷労働時間</span>
                </div>
                <span className="font-semibold shrink-0 text-slate-200">
                  {profile?.work_hours_month ? `¥${Math.round(stats.income / profile.work_hours_month)}` : "-"}
                </span>
              </div>
              {/* 赤字危険度 */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-300">赤字危険度</span>
                  <span className="text-slate-600 ml-1.5">{stats.balance < 0 ? "危険" : "安全"}</span>
                </div>
                <span className={`font-semibold shrink-0 ${stats.balance < 0 ? "text-red-400" : "text-slate-200"}`}>
                  {stats.balance < 0 ? "高" : "低"}
                </span>
              </div>
              {/* 節約達成度合い */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-300">節約達成度合い</span>
                  <span className="text-slate-600 ml-1.5">貯蓄率20%以上で合格</span>
                </div>
                <span className={`font-semibold shrink-0 ${stats.savingRate >= 20 ? "text-emerald-400" : "text-orange-400"}`}>
                  {stats.savingRate}%
                </span>
              </div>
            </div>
          </div>

          {/* 予算進捗（条件付き） */}
          {stats.budgetProgress.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2">
              <h3 className="text-xs font-semibold text-slate-300 mb-1">予算進捗</h3>
              <div className="space-y-1">
                {stats.budgetProgress.map(b => (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">{b.category}</span>
                      <span className={b.pct >= 100 ? "text-red-400 font-bold" : b.pct >= 80 ? "text-orange-400" : "text-slate-300"}>
                        {formatCurrency(b.spent)} / {formatCurrency(b.amount)} ({b.pct}%)
                      </span>
                    </div>
                    <div className="h-1 bg-slate-700 rounded-full">
                      <div
                        className={`h-1 rounded-full ${b.pct >= 100 ? "bg-red-500" : b.pct >= 80 ? "bg-orange-400" : "bg-violet-500"}`}
                        style={{ width: `${Math.min(b.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 目標ローンの下にアイドル画像を挿入 */}
        <div className="flex flex-col items-center my-4">
          <img
            src="/idol/idol-girl.jpg"
            alt="画像"
            className="w-40 h-40 object-cover rounded-full shadow-lg border-4 border-pink-300 bg-pink-100 animate-bounce-slow"
            style={{ boxShadow: '0 4px 24px 0 rgba(255,192,203,0.25)' }}
          />
          <div className="mt-2 text-pink-400 font-bold text-lg drop-shadow">がんばろうね！</div>
        </div>

        {/* ══════════════════════════════
            右カラム：予測・ナビ
        ══════════════════════════════ */}
        <div className="flex flex-col gap-2">

          {/* 赤字・将来予測 */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 space-y-1">
            <h3 className="text-xs font-semibold text-slate-300 mb-1">🔮 赤字・将来予測</h3>

            <div className={`rounded-lg border px-2 py-1 ${stats.balance < 0 ? "border-red-500/40 bg-red-900/20" : "border-emerald-500/30 bg-emerald-900/20"}`}>
              <p className="text-[10px] text-slate-400">今月実績</p>
              <p className={`text-sm font-semibold ${stats.balance < 0 ? "text-red-300" : "text-emerald-300"}`}>
                {stats.balance < 0 ? `赤字 ${formatCurrency(Math.abs(stats.balance))}` : `黒字 ${formatCurrency(stats.balance)}`}
              </p>
            </div>

            <div className={`rounded-lg border px-2 py-1 ${forecast.projectedBalance < 0 ? "border-red-500/40 bg-red-900/20" : "border-blue-500/30 bg-blue-900/20"}`}>
              <p className="text-[10px] text-slate-400">月末見込み（進捗 {forecast.daysElapsed}/{forecast.daysInMonth}日）</p>
              <p className={`text-sm font-semibold ${forecast.projectedBalance < 0 ? "text-red-300" : "text-blue-300"}`}>
                {forecast.projectedBalance < 0
                  ? `赤字見込み ${formatCurrency(Math.abs(forecast.projectedBalance))}`
                  : `黒字見込み ${formatCurrency(forecast.projectedBalance)}`}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                収入見込み {formatCurrency(forecast.projectedIncome)} / 支出見込み {formatCurrency(forecast.projectedExpense)}
              </p>
            </div>

            <div className={`rounded-lg border px-2 py-1 ${forecast.annualProjection < 0 ? "border-red-500/40 bg-red-900/20" : "border-violet-500/30 bg-violet-900/20"}`}>
              <p className="text-[10px] text-slate-400">12か月予測（直近3か月平均）</p>
              <p className={`text-sm font-semibold ${forecast.annualProjection < 0 ? "text-red-300" : "text-violet-300"}`}>
                {forecast.annualProjection < 0
                  ? `年間赤字見込み ${formatCurrency(Math.abs(forecast.annualProjection))}`
                  : `年間黒字見込み ${formatCurrency(forecast.annualProjection)}`}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">平均月次収支: {formatCurrency(forecast.avgMonthlyBalance)}</p>
            </div>

            <div className={`rounded-lg border px-2 py-1 ${forecastSavings.annualSavingsProjection <= 0 ? "border-red-500/40 bg-red-900/20" : "border-sky-500/30 bg-sky-900/20"}`}>
              <p className="text-[10px] text-slate-400">将来貯金予測</p>
              <p className={`text-sm font-semibold ${forecastSavings.annualSavingsProjection <= 0 ? "text-red-300" : "text-sky-300"}`}>
                12か月 {formatCurrency(forecastSavings.annualSavingsProjection)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                今月 {formatCurrency(forecastSavings.monthlySavingsActual)} / 月末見込み {formatCurrency(forecastSavings.projectedMonthlySavings)}
                　赤字リスク: <span className={forecastSavings.deficitRisk === "high" ? "text-red-300" : forecastSavings.deficitRisk === "mid" ? "text-amber-300" : "text-emerald-300"}>
                  {forecastSavings.deficitRisk === "high" ? "高" : forecastSavings.deficitRisk === "mid" ? "中" : "低"}
                </span>
              </p>
            </div>
          </div>

          {/* 防衛資金 */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300">🛡 防衛資金目安</h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDefenseBasis("expense")}
                  className={`px-2 py-0.5 rounded text-[10px] border ${defenseBasis === "expense" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
                >
                  総支出
                </button>
                <button
                  type="button"
                  onClick={() => setDefenseBasis("fixed")}
                  className={`px-2 py-0.5 rounded text-[10px] border ${defenseBasis === "fixed" ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-300"}`}
                >
                  固定費
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              基準月額 {formatCurrency(defenseMonthlyBase)}　目安: 最低 {formatCurrency(defenseMinimum)} / 推奨 {formatCurrency(defenseTarget)}
            </p>
            <p className={`text-sm font-semibold ${defenseShortfall > 0 ? "text-amber-300" : "text-emerald-300"}`}>
              現在 {formatCurrency(defenseFund)} / 不足 {formatCurrency(defenseShortfall)}
            </p>
            <p className="text-[10px] text-slate-400">
              到達見込み: {defenseEtaMonths === 0 ? "達成済み" : defenseEtaMonths == null ? "算出不可" : `約${defenseEtaMonths}か月（${defenseEtaDateLabel}）`}
            </p>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-1.5 ${defenseProgress >= 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${defenseProgress}%` }} />
            </div>
          </div>

          {/* 改善ナビ */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300">🧭 改善ナビ</h3>
              <span className="text-[10px] text-slate-500">支出トレンド {expenseTrend.changeRate >= 0 ? `+${expenseTrend.changeRate}` : expenseTrend.changeRate}%</span>
            </div>

            <div className="grid grid-cols-2 gap-1">
              {[
                { mode: "standard" as const, label: "経済標準" },
                { mode: "inflation" as const, label: "物価高対策" },
                { mode: "deficit" as const, label: "赤字改善" },
                { mode: "custom" as const, label: "カスタム" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStrategyMode(mode)}
                  className={`text-[10px] py-1.5 rounded border transition-all ${
                    strategyMode === mode
                      ? mode === "custom" ? "bg-cyan-700 border-cyan-500 text-white" : "bg-violet-600 border-violet-500 text-white"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1 text-xs text-slate-300 space-y-0.5">
              <p className="font-semibold text-slate-200">{policyTargets.title}</p>
              <p className="text-[10px]">固定費 {policyTargets.fixed}% / 変動費 {policyTargets.variable}% / 貯蓄+投資 {policyTargets.savings}%</p>
              <p className="text-[10px] text-slate-400">{policyTargets.notes}</p>
            </div>

            <div className="space-y-1">
              {improvementNav.map((action, index) => (
                <div key={action} className="rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1 text-xs text-slate-300">
                  <span className="text-slate-500 mr-1">{index + 1}.</span>{action}
                </div>
              ))}
            </div>

            <details className="rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1 text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold text-slate-200">経済指標の説明資料</summary>
              <div className="mt-2 space-y-1 text-slate-300 leading-relaxed">
                <p><span className="font-semibold">CPI</span>: 物価の平均的な上昇率。上がるほど同じ金額で買える量が減ります。</p>
                <p><span className="font-semibold">実質賃金</span>: 名目賃金から物価上昇分を差し引いた購買力。</p>
                <p><span className="font-semibold">政策金利</span>: 借入・預金金利に影響。高金利局面では変動ローンの負担が増えやすい。</p>
                <p><span className="font-semibold">為替（円安）</span>: 輸入品やエネルギー価格に影響。食料・光熱費が上がりやすい。</p>
                <p><span className="font-semibold">家計での使い方</span>: 物価高局面は固定費見直し・変動費の週予算化を先に行い、余力を先取り貯蓄へ。</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );

}
