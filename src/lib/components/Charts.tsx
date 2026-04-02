"use client"

import { Transaction, formatCurrency } from "@/lib/utils"
import { useMemo } from "react"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts"

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6", "#ec4899", "#84cc16"]

export default function Charts({ transactions, currentMonth }: Props) {
  const formatTooltipValue = (
    value: number | string | ReadonlyArray<number | string> | undefined
  ) => {
    const raw = Array.isArray(value) ? value[0] : value
    const num = typeof raw === "number" ? raw : Number(raw ?? 0)
    return formatCurrency(Number.isFinite(num) ? num : 0)
  }

  const { pieData, lineData, radarData } = useMemo(() => {
    // 円グラフ：支出カテゴリ
    const monthly = transactions.filter(t => t.date.startsWith(currentMonth))
    const catMap: Record<string, number> = {}
    monthly.filter(t => t.type === "expense").forEach(t => {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount
    })
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }))

    // 折れ線グラフ：過去6ヶ月収支
    const now = new Date(currentMonth + "-01")
    const lineData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const txs = transactions.filter(t => t.date.startsWith(m))
      return {
        month: `${d.getMonth() + 1}月`,
        収入: txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
        支出: txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        貯金: txs.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0),
      }
    })

    // レーダーチャート：財務バランス
    const income = monthly.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = monthly.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const saving = monthly.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
    const investment = monthly.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
    const fixed = monthly.filter(t => t.is_fixed).reduce((s, t) => s + t.amount, 0)
    const radarData = [
      { subject: "収入安定", value: income > 0 ? Math.min(100, (income / 500000) * 100) : 0 },
      { subject: "節約力", value: income > 0 ? Math.max(0, 100 - (expense / income) * 100) : 0 },
      { subject: "貯蓄力", value: income > 0 ? Math.min(100, (saving / income) * 200) : 0 },
      { subject: "投資力", value: income > 0 ? Math.min(100, (investment / income) * 300) : 0 },
      { subject: "固定費管理", value: expense > 0 ? Math.max(0, 100 - (fixed / expense) * 100) : 50 },
    ]

    return { pieData, lineData, radarData }
  }, [transactions, currentMonth])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 支出カテゴリ円グラフ */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">支出カテゴリ</h3>
        {pieData.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">データがありません</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {d.name}: {formatCurrency(d.value)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 月別収支折れ線 */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">月別収支（過去6ヶ月）</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `${v / 10000}万`} />
            <Tooltip formatter={formatTooltipValue} contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
            <Line type="monotone" dataKey="収入" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="支出" stroke="#f43f5e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="貯金" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs justify-center">
          {[["収入", "#10b981"], ["支出", "#f43f5e"], ["貯金", "#3b82f6"]].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1 text-slate-400">
              <span className="w-3 h-0.5 inline-block" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* レーダーチャート */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">財務バランス</h3>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Radar name="score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
