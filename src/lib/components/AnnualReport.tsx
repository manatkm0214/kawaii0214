"use client"

import { Transaction, formatCurrency } from "@/lib/utils"
import { useMemo, useState } from "react"

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

export default function AnnualReport({ transactions, currentMonth }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiReport, setAiReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const monthlyData = useMemo(() => {
    const now = new Date(currentMonth + "-01")
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const txs = transactions.filter(t => t.date.startsWith(m))
      const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
      const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      const saving = txs.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
      const investment = txs.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
      const savingRate = income > 0 ? Math.round(((saving + investment) / income) * 100) : 0
      return { month: `${d.getMonth() + 1}月`, income, expense, saving, investment, savingRate }
    })
  }, [transactions, currentMonth])

  const totals = useMemo(() => ({
    income: monthlyData.reduce((s, m) => s + m.income, 0),
    expense: monthlyData.reduce((s, m) => s + m.expense, 0),
    saving: monthlyData.reduce((s, m) => s + m.saving, 0),
    investment: monthlyData.reduce((s, m) => s + m.investment, 0),
    avgSavingRate: Math.round(monthlyData.reduce((s, m) => s + m.savingRate, 0) / 12),
  }), [monthlyData])

  const autoInsights = useMemo(() => {
    const withData = monthlyData.filter(m => m.income > 0)
    if (withData.length === 0) return null
    const bestSaving = withData.reduce((a, b) => b.savingRate > a.savingRate ? b : a)
    const worstExpense = withData.reduce((a, b) => b.expense > a.expense ? b : a)
    const bestIncome = withData.reduce((a, b) => b.income > a.income ? b : a)
    const netFlow = totals.income - totals.expense - totals.saving - totals.investment
    return { bestSaving, worstExpense, bestIncome, netFlow, monthsWithData: withData.length }
  }, [monthlyData, totals])

  async function fetchAiReport() {
    setLoading(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "annual", data: { monthlyData } }),
      })
      const { result } = await res.json()
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim())
      setAiReport(parsed)
    } catch {
      alert("AI分析に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function downloadPDF() {
    setPdfLoading(true)
    const { default: jsPDF } = await import("jspdf")
    const doc = new jsPDF()

    // タイトル
    doc.setFontSize(20)
    doc.text("年間家計レポート", 20, 20)
    doc.setFontSize(12)
    doc.text(`期間: ${monthlyData[0].month} ～ ${monthlyData[11].month}`, 20, 32)

    // 年間合計
    doc.setFontSize(14)
    doc.text("年間サマリ", 20, 50)
    doc.setFontSize(11)
    const lines = [
      `収入合計: ${formatCurrency(totals.income)}`,
      `支出合計: ${formatCurrency(totals.expense)}`,
      `貯金合計: ${formatCurrency(totals.saving)}`,
      `投資合計: ${formatCurrency(totals.investment)}`,
      `平均貯蓄率: ${totals.avgSavingRate}%`,
    ]
    lines.forEach((l, i) => doc.text(l, 20, 62 + i * 8))

    // 月別データ表
    doc.setFontSize(14)
    doc.text("月別データ", 20, 116)
    doc.setFontSize(9)
    doc.text("月　　　収入　　　　支出　　　　貯金　　　貯蓄率", 20, 126)
    monthlyData.forEach((m, i) => {
      doc.text(
        `${m.month.padEnd(4)}  ${String(m.income).padStart(8)}  ${String(m.expense).padStart(8)}  ${String(m.saving).padStart(8)}  ${m.savingRate}%`,
        20, 134 + i * 7
      )
    })

    // AI総評
    if (aiReport) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text("AI年間総評", 20, 20)
      doc.setFontSize(11)
      const splitSummary = doc.splitTextToSize(aiReport.annual_summary, 170)
      doc.text(splitSummary, 20, 32)
      if (aiReport.next_year) {
        doc.setFontSize(12)
        doc.text("来年へのアドバイス", 20, 70)
        doc.setFontSize(10)
        aiReport.next_year.forEach((tip: string, i: number) => {
          const split = doc.splitTextToSize(`${i + 1}. ${tip}`, 170)
          doc.text(split, 20, 80 + i * 14)
        })
      }
    }

    doc.save(`家計レポート_${currentMonth}.pdf`)
    setPdfLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="animate-fade-in grid grid-cols-2 gap-2">

      {/* 左カラム: サマリ + AI総評 + エクスポート */}
      <div className="flex flex-col gap-2">

        {/* 年間サマリ */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 年間サマリ</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "収入合計", value: totals.income, color: "text-emerald-400" },
              { label: "支出合計", value: totals.expense, color: "text-red-400" },
              { label: "貯金合計", value: totals.saving, color: "text-blue-400" },
              { label: "投資合計", value: totals.investment, color: "text-violet-400" },
            ].map(item => (
              <div key={item.label} className="bg-slate-900/50 rounded-xl p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`font-bold text-sm ${item.color}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-slate-900/50 rounded-xl p-3 flex justify-between">
            <span className="text-xs text-slate-400">年間平均貯蓄率</span>
            <span className="font-bold text-violet-400">{totals.avgSavingRate}%</span>
          </div>
        </div>

        {/* AI年間総評 */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">🤖 AI年間総評</h3>
            <button
              onClick={fetchAiReport}
              disabled={loading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-xs transition-all"
            >
              {loading ? "分析中..." : "AI分析"}
            </button>
          </div>
          {aiReport ? (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs text-slate-300 leading-relaxed">{aiReport.annual_summary}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2">
                  <p className="text-xs text-emerald-400 font-semibold mb-1">最良の月</p>
                  <p className="text-xs text-slate-400">{aiReport.best_month}</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2">
                  <p className="text-xs text-red-400 font-semibold mb-1">要改善の月</p>
                  <p className="text-xs text-slate-400">{aiReport.worst_month}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-blue-400 font-semibold mb-1">来年へのアドバイス</p>
                {Array.isArray(aiReport.next_year)
                  ? aiReport.next_year.map((a: string, i: number) => (
                      <p key={i} className="text-xs text-slate-400 ml-2">{i + 1}. {a}</p>
                    ))
                  : <p className="text-xs text-slate-400 ml-2">{aiReport.next_year}</p>
                }
              </div>
            </div>
          ) : autoInsights ? (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs text-slate-500 mb-2">データから自動集計したハイライトです。AIボタンで詳細な総評を取得できます。</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2">
                  <p className="text-xs text-emerald-400 font-semibold mb-1">貯蓄率 最高月</p>
                  <p className="text-xs text-slate-300">{autoInsights.bestSaving.month}</p>
                  <p className="text-xs text-emerald-400">{autoInsights.bestSaving.savingRate}%</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2">
                  <p className="text-xs text-red-400 font-semibold mb-1">支出 最大月</p>
                  <p className="text-xs text-slate-300">{autoInsights.worstExpense.month}</p>
                  <p className="text-xs text-red-400">{formatCurrency(autoInsights.worstExpense.expense)}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-2">
                  <p className="text-xs text-blue-400 font-semibold mb-1">収入 最大月</p>
                  <p className="text-xs text-slate-300">{autoInsights.bestIncome.month}</p>
                  <p className="text-xs text-blue-400">{formatCurrency(autoInsights.bestIncome.income)}</p>
                </div>
                <div className={`rounded-lg p-2 border ${autoInsights.netFlow >= 0 ? "bg-violet-900/20 border-violet-700/30" : "bg-orange-900/20 border-orange-700/30"}`}>
                  <p className={`text-xs font-semibold mb-1 ${autoInsights.netFlow >= 0 ? "text-violet-400" : "text-orange-400"}`}>未配分残高</p>
                  <p className="text-xs text-slate-300">{formatCurrency(Math.abs(autoInsights.netFlow))}</p>
                  <p className={`text-xs ${autoInsights.netFlow >= 0 ? "text-violet-400" : "text-orange-400"}`}>{autoInsights.netFlow >= 0 ? "余剰" : "超過"}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 text-right">集計対象: {autoInsights.monthsWithData}ヶ月</p>
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-4">データがありません</p>
          )}
        </div>

        {/* エクスポートボタン */}
        <div className="flex gap-2">
          <button
            onClick={downloadPDF}
            disabled={pdfLoading}
            className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl text-sm font-medium transition-all"
          >
            {pdfLoading ? "生成中..." : "📄 PDFダウンロード"}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-all no-print"
          >
            🖨️ 印刷
          </button>
        </div>

      </div>{/* /左カラム */}

      {/* 右カラム: 月別テーブル + 貯蓄率チャート */}
      <div className="flex flex-col gap-2">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 overflow-x-auto print-page">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">月別データ</h3>
          <table className="w-full text-xs text-slate-400">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="py-1 text-left">月</th>
                <th className="py-1 text-right">収入</th>
                <th className="py-1 text-right">支出</th>
                <th className="py-1 text-right">貯金</th>
                <th className="py-1 text-right">投資</th>
                <th className="py-1 text-right">貯蓄率</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={m.month} className="border-b border-slate-800/50">
                  <td className="py-1">{m.month}</td>
                  <td className="py-1 text-right text-emerald-400">{m.income > 0 ? formatCurrency(m.income) : "-"}</td>
                  <td className="py-1 text-right text-red-400">{m.expense > 0 ? formatCurrency(m.expense) : "-"}</td>
                  <td className="py-1 text-right text-blue-400">{m.saving > 0 ? formatCurrency(m.saving) : "-"}</td>
                  <td className="py-1 text-right text-violet-400">{m.investment > 0 ? formatCurrency(m.investment) : "-"}</td>
                  <td className="py-1 text-right">{m.savingRate > 0 ? `${m.savingRate}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 貯蓄率バーチャート */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📈 月別貯蓄率</h3>
          <div className="space-y-1">
            {monthlyData.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-6 shrink-0">{m.month.replace("月", "")}</span>
                <div className="flex-1 bg-slate-900/60 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m.savingRate >= 20 ? "bg-emerald-500" : m.savingRate >= 10 ? "bg-blue-500" : m.savingRate > 0 ? "bg-amber-500" : "bg-slate-700"}`}
                    style={{ width: `${Math.min(m.savingRate, 100)}%` }}
                  />
                </div>
                <span className={`text-xs w-8 text-right ${m.savingRate >= 20 ? "text-emerald-400" : m.savingRate >= 10 ? "text-blue-400" : m.savingRate > 0 ? "text-amber-400" : "text-slate-600"}`}>
                  {m.savingRate > 0 ? `${m.savingRate}%` : "-"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-3 pt-2 border-t border-slate-700/50">
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>20%以上</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>10-19%</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>1-9%</span>
          </div>
        </div>
      </div>{/* /右カラム */}

    </div>
  )
}
