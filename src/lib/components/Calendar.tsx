"use client"

import { Transaction, formatCurrency } from "@/lib/utils"
import { useMemo, useState, useCallback } from "react"

interface Props {
  transactions: Transaction[]
  currentMonth: string // "YYYY-MM"
}

interface CalendarEvent {
  id: string
  date: string  // YYYY-MM-DD
  title: string
  note: string
  amount: number | null
  type: "reminder" | "income_plan" | "expense_plan" | "goal"
}

interface CalendarAIResult {
  month_summary: string
  calendar_tips: string[]
  upcoming_warnings: string[]
  best_saving_day: string
  annual_pattern: string
}

const EVENT_STORAGE_KEY = "kakeibo-calendar-events"

const EVENT_TYPE_LABEL: Record<CalendarEvent["type"], string> = {
  reminder:     "📌 リマインダー",
  income_plan:  "💰 収入予定",
  expense_plan: "💸 支出予定",
  goal:         "🎯 目標",
}

const EVENT_TYPE_COLOR: Record<CalendarEvent["type"], string> = {
  reminder:     "text-sky-400",
  income_plan:  "text-emerald-400",
  expense_plan: "text-orange-400",
  goal:         "text-violet-400",
}

const EVENT_TYPE_DOT: Record<CalendarEvent["type"], string> = {
  reminder:     "bg-sky-400",
  income_plan:  "bg-emerald-400",
  expense_plan: "bg-orange-400",
  goal:         "bg-violet-400",
}

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"]

const TX_TYPE_ICON: Record<string, string> = {
  income: "↑", expense: "↓", saving: "貯", investment: "投",
}
const TX_TYPE_COLOR: Record<string, string> = {
  income: "text-emerald-400", expense: "text-red-400",
  saving: "text-sky-400", investment: "text-violet-400",
}

// ── ユーティリティ ──────────────────────────────────────────────────────────

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}

function firstWeekday(ym: string): number {
  const [y, m] = ym.split("-").map(Number)
  const day = new Date(y, m - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── メインコンポーネント ─────────────────────────────────────────────────────

export default function Calendar({ transactions, currentMonth }: Props) {
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const [trackedMonth, setTrackedMonth] = useState(currentMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // ビュー切替: "grid"=月グリッド / "year"=12か月一覧
  const [viewMode, setViewMode] = useState<"grid" | "year">("grid")

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      if (typeof window === "undefined") return []
      const raw = localStorage.getItem(EVENT_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CalendarEvent[]) : []
    } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ title: string; note: string; amount: string; type: CalendarEvent["type"] }>({
    title: "", note: "", amount: "", type: "reminder",
  })

  // AI
  const [aiResult, setAiResult] = useState<CalendarAIResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)

  // 親の currentMonth 変更に追従
  if (trackedMonth !== currentMonth) {
    setTrackedMonth(currentMonth)
    setViewMonth(currentMonth)
    setSelectedDay(null)
  }

  const today = todayString()

  const saveEvents = useCallback((next: CalendarEvent[]) => {
    setEvents(next)
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(next))
  }, [])

  function addEvent() {
    if (!form.title.trim() || !selectedDay) return
    const evt: CalendarEvent = {
      id: newId(),
      date: selectedDay,
      title: form.title.trim(),
      note: form.note.trim(),
      amount: form.amount ? Number(form.amount) : null,
      type: form.type,
    }
    saveEvents([...events, evt])
    setForm({ title: "", note: "", amount: "", type: "reminder" })
    setShowForm(false)
  }

  function deleteEvent(id: string) {
    saveEvents(events.filter(e => e.id !== id))
  }

  // 取引をday別にグループ化
  const txByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
    return map
  }, [transactions])

  const evtByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  // 12か月分のストリップデータ
  const stripMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(viewMonth, -11 + i)), [viewMonth])

  const stripStats = useMemo(() => stripMonths.map(ym => {
    let income = 0, expense = 0
    for (const t of transactions) {
      if (!t.date.startsWith(ym)) continue
      if (t.type === "income") income += t.amount
      else if (t.type === "expense") expense += t.amount
    }
    const evtCount = events.filter(e => e.date.startsWith(ym)).length
    const balance = income - expense
    return { ym, income, expense, evtCount, balance }
  }), [stripMonths, transactions, events])

  // グリッドセル
  const gridCells = useMemo(() => {
    const offset = firstWeekday(viewMonth)
    const days = daysInMonth(viewMonth)
    const cells: Array<{ date: string | null }> = []
    for (let i = 0; i < offset; i++) cells.push({ date: null })
    for (let d = 1; d <= days; d++) cells.push({ date: `${viewMonth}-${String(d).padStart(2, "0")}` })
    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [viewMonth])

  function dayNet(date: string): number {
    return (txByDay[date] ?? []).reduce((s, t) => {
      if (t.type === "income") return s + t.amount
      if (t.type === "expense") return s - t.amount
      return s
    }, 0)
  }

  const selectedTxs = selectedDay ? (txByDay[selectedDay] ?? []) : []
  const selectedEvts = selectedDay ? (evtByDay[selectedDay] ?? []) : []

  // AI 呼び出し
  async function fetchAIAdvice() {
    setAiLoading(true)
    setAiError(null)
    try {
      const monthlyData = stripStats.map(s => ({
        ym: s.ym,
        income: s.income,
        expense: s.expense,
        balance: s.balance,
        eventCount: s.evtCount,
      }))

      const currentTxs = transactions.filter(t => t.date.startsWith(viewMonth))
      const categoryExpenses: Record<string, number> = {}
      currentTxs.filter(t => t.type === "expense").forEach(t => {
        categoryExpenses[t.category] = (categoryExpenses[t.category] ?? 0) + t.amount
      })

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "calendar_advice",
          data: {
            currentMonth: viewMonth,
            monthlyData,
            categoryExpenses,
            eventCount: events.filter(e => e.date.startsWith(viewMonth)).length,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "AI呼び出し失敗")
      const parsed = typeof json.result === "string" ? JSON.parse(json.result) : json.result
      setAiResult(parsed)
      setShowAI(true)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setAiLoading(false)
    }
  }

  // ── 年間ビュー ─────────────────────────────────────────────────────────────
  function YearView() {
    const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => {
      const base = `${viewMonth.slice(0, 4)}-01`
      return addMonths(base, i)
    }), [])

    const maxExpense = Math.max(...yearMonths.map(ym => {
      return transactions.filter(t => t.date.startsWith(ym) && t.type === "expense")
        .reduce((s, t) => s + t.amount, 0)
    }), 1)

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {yearMonths.map(ym => {
            const txs = transactions.filter(t => t.date.startsWith(ym))
            const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
            const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
            const saving = txs.filter(t => t.type === "saving" || t.type === "investment").reduce((s, t) => s + t.amount, 0)
            const balance = income - expense - saving
            const evts = events.filter(e => e.date.startsWith(ym))
            const isActive = ym === viewMonth
            const offset = firstWeekday(ym)
            const days = daysInMonth(ym)
            const cells: Array<string | null> = []
            for (let i = 0; i < offset; i++) cells.push(null)
            for (let d = 1; d <= days; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`)
            while (cells.length % 7 !== 0) cells.push(null)

            return (
              <div
                key={ym}
                className={`rounded-xl border p-2 cursor-pointer transition-all ${isActive ? "border-violet-500 bg-violet-900/20" : "border-slate-700/50 bg-slate-800/40 hover:border-slate-500"}`}
                onClick={() => { setViewMonth(ym); setViewMode("grid"); setSelectedDay(null) }}
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${isActive ? "text-violet-300" : "text-slate-300"}`}>
                    {ym.slice(0, 4)}年{parseInt(ym.slice(5))}月
                  </span>
                  {evts.length > 0 && (
                    <span className="text-[9px] text-sky-400">{evts.length}件</span>
                  )}
                </div>

                {/* ミニカレンダーグリッド */}
                <div className="grid grid-cols-7 gap-px mb-1.5">
                  {["月","火","水","木","金","土","日"].map(w => (
                    <div key={w} className="text-center text-[7px] text-slate-600">{w}</div>
                  ))}
                  {cells.map((date, idx) => {
                    if (!date) return <div key={`e${idx}`} className="h-3" />
                    const hasTx = !!txByDay[date]?.length
                    const hasEvt = !!evtByDay[date]?.length
                    const net = hasTx ? dayNet(date) : 0
                    const isToday = date === today
                    return (
                      <div
                        key={date}
                        onClick={e => { e.stopPropagation(); setViewMonth(ym); setSelectedDay(date); setViewMode("grid") }}
                        className={`h-3 rounded-sm flex items-center justify-center text-[7px] transition-colors ${
                          isToday ? "ring-1 ring-violet-400 text-violet-300"
                          : hasTx ? (net >= 0 ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400")
                          : hasEvt ? "bg-sky-900/30 text-sky-400"
                          : "text-slate-700"
                        }`}
                      >
                        {parseInt(date.slice(-2))}
                      </div>
                    )
                  })}
                </div>

                {/* 収支バー */}
                <div className="space-y-0.5">
                  {income > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-emerald-400 w-4 shrink-0">収</span>
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-1 bg-emerald-500" style={{ width: `${Math.min(100, Math.round(income / maxExpense * 100))}%` }} />
                      </div>
                      <span className="text-[8px] text-emerald-400 shrink-0">{income >= 10000 ? `${Math.round(income/10000)}万` : income >= 1000 ? `${Math.round(income/1000)}千` : income}</span>
                    </div>
                  )}
                  {expense > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-red-400 w-4 shrink-0">支</span>
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-1 bg-red-500" style={{ width: `${Math.min(100, Math.round(expense / maxExpense * 100))}%` }} />
                      </div>
                      <span className="text-[8px] text-red-400 shrink-0">{expense >= 10000 ? `${Math.round(expense/10000)}万` : expense >= 1000 ? `${Math.round(expense/1000)}千` : expense}</span>
                    </div>
                  )}
                  {income === 0 && expense === 0 && (
                    <p className="text-[8px] text-slate-600 text-center">記録なし</p>
                  )}
                  {(income > 0 || expense > 0) && (
                    <p className={`text-[8px] font-semibold text-right ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {balance >= 0 ? "+" : ""}{balance >= 10000 ? `${Math.round(balance/10000)}万` : balance >= 1000 ? `${Math.round(balance/1000)}千` : balance}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 年間サマリー */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
          <p className="text-xs font-semibold text-slate-300 mb-2">📊 {viewMonth.slice(0, 4)}年 年間サマリー</p>
          <div className="grid grid-cols-2 gap-2">
            {(() => {
              const year = viewMonth.slice(0, 4)
              const allTxs = transactions.filter(t => t.date.startsWith(year))
              const totalIncome = allTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
              const totalExpense = allTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
              const totalSaving = allTxs.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
              const totalInvestment = allTxs.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
              return [
                { label: "年間収入", val: totalIncome, color: "text-emerald-400" },
                { label: "年間支出", val: totalExpense, color: "text-red-400" },
                { label: "年間貯金", val: totalSaving, color: "text-sky-400" },
                { label: "年間投資", val: totalInvestment, color: "text-violet-400" },
              ].map(item => (
                <div key={item.label} className="bg-slate-900/50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-500">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>
                    {item.val >= 10000 ? `${(item.val / 10000).toFixed(1)}万` : formatCurrency(item.val)}
                  </p>
                </div>
              ))
            })()}
          </div>
        </div>
      </div>
    )
  }

  // ── 月グリッドビュー ────────────────────────────────────────────────────────
  function GridView() {
    return (
      <div className="flex flex-col gap-3">
        {/* カレンダーグリッド */}
        <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/50">
          <div className="grid grid-cols-7 border-b border-slate-700">
            {WEEKDAYS.map(wd => (
              <div key={wd} className="text-center text-xs font-medium py-2 text-slate-400">{wd}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridCells.map((cell, idx) => {
              if (!cell.date) return <div key={`e${idx}`} className="h-16 border-b border-r border-slate-700/40" />
              const date = cell.date
              const txs = txByDay[date] ?? []
              const evts = evtByDay[date] ?? []
              const hasTx = txs.length > 0
              const hasEvt = evts.length > 0
              const net = hasTx ? dayNet(date) : 0
              const isToday = date === today
              const isSelected = date === selectedDay
              const dayNum = parseInt(date.split("-")[2], 10)

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => { setSelectedDay(isSelected ? null : date); setShowForm(false) }}
                  className={`h-16 p-1 border-b border-r border-slate-700/40 flex flex-col items-start text-left transition-colors ${
                    isSelected ? "bg-violet-800/50" : "hover:bg-slate-700/30"
                  }`}
                >
                  <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? "ring-2 ring-violet-400 text-violet-300"
                    : hasTx || hasEvt ? "text-slate-200"
                    : "text-slate-600"
                  }`}>{dayNum}</span>
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {hasTx && (
                      <span className={`w-1.5 h-1.5 rounded-full ${net >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
                    )}
                    {evts.slice(0, 3).map(e => (
                      <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_DOT[e.type]}`} />
                    ))}
                  </div>
                  {hasTx && (
                    <span className={`text-[9px] leading-none ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {Math.abs(net) >= 10000 ? `${Math.round(Math.abs(net) / 10000)}万` : Math.abs(net) >= 1000 ? `${Math.round(Math.abs(net) / 1000)}千` : Math.abs(net)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 日別詳細パネル */}
        {selectedDay && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-200 font-semibold text-sm">{selectedDay.replace(/-/g, "/")}</p>
              <button
                type="button"
                onClick={() => { setShowForm(v => !v) }}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-medium transition-all"
              >
                {showForm ? "✕ 閉じる" : "＋ 予定を追加"}
              </button>
            </div>

            {showForm && (
              <div className="mb-4 bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-2 animate-fade-in">
                <div className="flex gap-1 flex-wrap">
                  {(Object.entries(EVENT_TYPE_LABEL) as [CalendarEvent["type"], string][]).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: k }))}
                      className={`px-2 py-1 rounded-lg text-xs border transition-all ${
                        form.type === k ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400"
                      }`}
                    >{label}</button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="タイトル（例：電気代、健康診断）"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="金額（任意）"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                  <input
                    type="text"
                    placeholder="メモ（任意）"
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={addEvent}
                  disabled={!form.title.trim()}
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-all"
                >
                  📅 保存
                </button>
              </div>
            )}

            {selectedEvts.length > 0 && (
              <div className="mb-3 space-y-1.5">
                <p className="text-xs text-slate-500 mb-1">📌 予定</p>
                {selectedEvts.map(e => (
                  <div key={e.id} className="flex items-start justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${EVENT_TYPE_COLOR[e.type]}`}>{EVENT_TYPE_LABEL[e.type]}</span>
                        <span className="text-sm text-slate-200">{e.title}</span>
                      </div>
                      {e.amount != null && (
                        <span className={`text-xs ${EVENT_TYPE_COLOR[e.type]}`}>{formatCurrency(e.amount)}</span>
                      )}
                      {e.note && <p className="text-xs text-slate-500 mt-0.5">{e.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteEvent(e.id)}
                      className="ml-2 shrink-0 text-xs text-slate-600 hover:text-red-400 transition-colors"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {selectedTxs.length > 0 ? (
              <div>
                <p className="text-xs text-slate-500 mb-1">💳 取引</p>
                <ul className="space-y-1.5">
                  {selectedTxs.map(t => (
                    <li key={t.id} className="flex items-center justify-between text-sm bg-slate-900/30 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-xs font-bold shrink-0 ${TX_TYPE_COLOR[t.type]}`}>
                          {TX_TYPE_ICON[t.type]}
                        </span>
                        <span className="text-slate-300 text-xs truncate">{t.category}</span>
                        {t.memo && <span className="text-slate-600 text-xs truncate">{t.memo}</span>}
                      </div>
                      <span className={`font-semibold shrink-0 text-xs ${TX_TYPE_COLOR[t.type]}`}>
                        {t.type === "expense" ? "−" : "+"}{formatCurrency(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : selectedEvts.length === 0 && (
              <p className="text-slate-500 text-xs">この日の取引も予定もありません</p>
            )}
          </div>
        )}

        {!selectedDay && (
          <p className="text-center text-slate-600 text-xs py-2">日付をクリックして予定・取引を確認</p>
        )}
      </div>
    )
  }

  // ── AI結果パネル ──────────────────────────────────────────────────────────
  function AIPanel() {
    if (!showAI && !aiLoading && !aiError) return null
    return (
      <div className="rounded-xl border border-violet-700/40 bg-violet-900/10 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">🤖 AI カレンダーアドバイス</p>
          {showAI && <button type="button" onClick={() => setShowAI(false)} className="text-[10px] text-slate-500 hover:text-slate-300">閉じる</button>}
        </div>

        {aiLoading && <p className="text-xs text-slate-400 animate-pulse">分析中...</p>}
        {aiError && <p className="text-xs text-red-400">{aiError}</p>}

        {aiResult && showAI && (
          <div className="space-y-2 text-xs">
            {/* 今月サマリー */}
            <div className="bg-slate-900/60 rounded-lg px-3 py-2">
              <p className="text-slate-200">{aiResult.month_summary}</p>
            </div>

            {/* カレンダーTips */}
            {aiResult.calendar_tips?.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1">📅 カレンダー活用のコツ</p>
                <div className="space-y-1">
                  {aiResult.calendar_tips.map((tip, i) => (
                    <div key={i} className="bg-slate-900/40 rounded-lg px-2 py-1.5 text-slate-300">
                      <span className="text-slate-500 mr-1">{i + 1}.</span>{tip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 注意点 */}
            {aiResult.upcoming_warnings?.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1">⚠️ 今後の注意点</p>
                <div className="space-y-1">
                  {aiResult.upcoming_warnings.map((w, i) => (
                    <div key={i} className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-2 py-1.5 text-amber-200">
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 節約タイミング */}
            {aiResult.best_saving_day && (
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-2">
                <p className="text-[10px] text-emerald-400 mb-0.5">💚 節約タイミング</p>
                <p className="text-slate-200">{aiResult.best_saving_day}</p>
              </div>
            )}

            {/* 年間パターン */}
            {aiResult.annual_pattern && (
              <div className="bg-slate-900/40 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 mb-0.5">📈 年間パターン</p>
                <p className="text-slate-300">{aiResult.annual_pattern}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── レンダリング ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">

      {/* ツールバー */}
      <div className="flex items-center gap-2">
        {/* ビュー切替 */}
        <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${viewMode === "grid" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
          >📅 月</button>
          <button
            type="button"
            onClick={() => setViewMode("year")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${viewMode === "year" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
          >📆 年</button>
        </div>

        {/* 月切替（グリッドビュー時） */}
        {viewMode === "grid" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { setViewMonth(addMonths(viewMonth, -1)); setSelectedDay(null) }}
              className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm">‹</button>
            <span className="text-slate-200 font-semibold text-sm min-w-20 text-center">{viewMonth.replace("-", "年")}月</span>
            <button type="button" onClick={() => { setViewMonth(addMonths(viewMonth, 1)); setSelectedDay(null) }}
              className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm">›</button>
          </div>
        )}

        {/* 年切替（年ビュー時） */}
        {viewMode === "year" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -12))}
              className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm">‹</button>
            <span className="text-slate-200 font-semibold text-sm min-w-16 text-center">{viewMonth.slice(0, 4)}年</span>
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 12))}
              className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm">›</button>
          </div>
        )}

        {/* AI ボタン */}
        <button
          type="button"
          onClick={fetchAIAdvice}
          disabled={aiLoading}
          className="ml-auto px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-xs font-medium transition-all flex items-center gap-1"
        >
          {aiLoading ? "⏳ 分析中..." : "🤖 AI分析"}
        </button>
      </div>

      {/* AI パネル */}
      <AIPanel />

      {/* ビュー本体 */}
      {viewMode === "grid" ? <GridView /> : <YearView />}
    </div>
  )
}
