"use client"

import { Transaction, Budget, formatCurrency } from "@/lib/utils"
import { useMemo } from "react"

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  currentMonth: string
}

function safeLevel(savingRate: number): { level: string; color: string; bar: number } {
  if (savingRate >= 30) return { level: "S", color: "text-emerald-400", bar: 100 }
  if (savingRate >= 20) return { level: "A", color: "text-green-400", bar: 80 }
  if (savingRate >= 10) return { level: "B", color: "text-yellow-400", bar: 60 }
  if (savingRate >= 5)  return { level: "C", color: "text-orange-400", bar: 40 }
  return { level: "D", color: "text-red-400", bar: 20 }
}

export default function Dashboard({ transactions, budgets, currentMonth }: Props) {
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
    const budgetProgress = budgets.map(b => {
      const spent = monthly.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0)
      return { ...b, spent, pct: Math.round((spent / b.amount) * 100) }
    })

    return { income, expense, saving, investment, balance, savingRate, fixedRate, wasteRate, defenseFund, fixed, categoryMap, budgetProgress }
  }, [transactions, budgets, currentMonth])

  const { level, color, bar } = safeLevel(stats.savingRate)

  const cards = [
    { label: "収入", value: stats.income, color: "from-emerald-500/20 to-emerald-600/5", text: "text-emerald-400" },
    { label: "支出", value: stats.expense, color: "from-red-500/20 to-red-600/5", text: "text-red-400" },
    { label: "貯金", value: stats.saving, color: "from-blue-500/20 to-blue-600/5", text: "text-blue-400" },
    { label: "収支", value: stats.balance, color: "from-violet-500/20 to-violet-600/5", text: stats.balance >= 0 ? "text-violet-400" : "text-red-400" },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 基本4指標 */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`bg-linear-to-br ${c.color} border border-slate-700/50 rounded-2xl p-4`}>
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

      {/* 詳細指標 */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">詳細指標</h3>
        {[
          { label: "貯蓄率", value: `${stats.savingRate}%`, good: stats.savingRate >= 20 },
          { label: "固定費率", value: `${stats.fixedRate}%`, good: stats.fixedRate <= 50 },
          { label: "浪費率", value: `${stats.wasteRate}%`, good: stats.wasteRate <= 30 },
          { label: "防衛資金（6ヶ月分）", value: formatCurrency(stats.defenseFund), good: true },
          { label: "固定費合計", value: formatCurrency(stats.fixed), good: true },
          { label: "投資額", value: formatCurrency(stats.investment), good: true },
        ].map(item => (
          <div key={item.label} className="flex justify-between items-center">
            <span className="text-xs text-slate-400">{item.label}</span>
            <span className={`text-sm font-semibold ${item.good ? "text-slate-200" : "text-orange-400"}`}>
              {item.value}
            </span>
          </div>
        ))}
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
