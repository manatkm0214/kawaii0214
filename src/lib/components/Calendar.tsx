"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatCurrency, getCategoryLabel, type Transaction } from "@/lib/utils"
import { useLang } from "@/lib/hooks/useLang"
import { AI_PROVIDERS, setAIProvider, useAIProvider } from "@/lib/hooks/useAIProvider"

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

type ViewMode = "grid" | "year"
type EventType = "reminder" | "income_plan" | "expense_plan" | "goal"

interface CalendarEvent {
  id: string
  date: string
  title: string
  note: string
  amount: number | null
  type: EventType
}

interface CalendarAIResult {
  month_summary: string
  calendar_tips: string[]
  upcoming_warnings: string[]
  best_saving_day: string
  annual_pattern: string
}

const EVENT_STORAGE_KEY = "kakeibo-calendar-events"

const EVENT_META: Record<EventType, { ja: string; en: string; color: string; dot: string }> = {
  reminder: { ja: "リマインド", en: "Reminder", color: "text-sky-300", dot: "bg-sky-400" },
  income_plan: { ja: "収入予定", en: "Income plan", color: "text-emerald-300", dot: "bg-emerald-400" },
  expense_plan: { ja: "支出予定", en: "Expense plan", color: "text-orange-300", dot: "bg-orange-400" },
  goal: { ja: "目標", en: "Goal", color: "text-violet-300", dot: "bg-violet-400" },
}

const WEEKDAYS = {
  ja: ["月", "火", "水", "木", "金", "土", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
} as const

const TX_META = {
  income: { ja: "収入", en: "Income", tone: "text-emerald-300", sign: "+" },
  expense: { ja: "支出", en: "Expense", tone: "text-rose-300", sign: "-" },
  saving: { ja: "貯蓄", en: "Saving", tone: "text-cyan-300", sign: "+" },
  investment: { ja: "投資", en: "Investment", tone: "text-violet-300", sign: "+" },
} as const

function addMonths(ym: string, delta: number) {
  const [year, month] = ym.split("-").map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function daysInMonth(ym: string) {
  const [year, month] = ym.split("-").map(Number)
  return new Date(year, month, 0).getDate()
}

function firstWeekday(ym: string) {
  const [year, month] = ym.split("-").map(Number)
  const weekday = new Date(year, month - 1, 1).getDay()
  return weekday === 0 ? 6 : weekday - 1
}

function todayString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function shortCurrency(value: number) {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 10000)}万`
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}千`
  return String(value)
}

function parseCalendarAIResult(raw: string): CalendarAIResult {
  const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const start = stripped.indexOf("{")
  const end = stripped.lastIndexOf("}")
  const jsonStr = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped
  try {
    return JSON.parse(jsonStr) as CalendarAIResult
  } catch {
    throw new Error("AI response could not be parsed.")
  }
}

export default function Calendar({ transactions, currentMonth }: Props) {
  const lang = useLang()
  const aiProvider = useAIProvider()
  const t = (ja: string, en: string) => (lang === "en" ? en : ja)

  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [form, setForm] = useState<{ title: string; note: string; amount: string; type: EventType }>({
    title: "",
    note: "",
    amount: "",
    type: "reminder",
  })
  const [aiResult, setAiResult] = useState<CalendarAIResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    setViewMonth(currentMonth)
    setSelectedDay(null)
    setShowForm(false)
  }, [currentMonth])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(EVENT_STORAGE_KEY)
      setEvents(raw ? (JSON.parse(raw) as CalendarEvent[]) : [])
    } catch {
      setEvents([])
    }
  }, [])

  const persistEvents = useCallback((next: CalendarEvent[]) => {
    setEvents(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(next))
    }
  }, [])

  const txByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    for (const tx of transactions) {
      if (!map[tx.date]) map[tx.date] = []
      map[tx.date].push(tx)
    }
    return map
  }, [transactions])

  const eventByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      if (!map[event.date]) map[event.date] = []
      map[event.date].push(event)
    }
    return map
  }, [events])

  const monthSummary = useMemo(() => {
    const monthTx = transactions.filter((tx) => tx.date.startsWith(viewMonth))
    const income = monthTx.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0)
    const expense = monthTx.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0)
    const saving = monthTx.filter((tx) => tx.type === "saving" || tx.type === "investment").reduce((sum, tx) => sum + tx.amount, 0)
    return { income, expense, saving, balance: income - expense - saving }
  }, [transactions, viewMonth])

  const stripMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => addMonths(viewMonth, index - 11)), [viewMonth])

  const stripStats = useMemo(
    () =>
      stripMonths.map((monthKey) => {
        const monthTx = transactions.filter((tx) => tx.date.startsWith(monthKey))
        const income = monthTx.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0)
        const expense = monthTx.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0)
        return {
          monthKey,
          income,
          expense,
          balance: income - expense,
          eventCount: events.filter((event) => event.date.startsWith(monthKey)).length,
        }
      }),
    [events, stripMonths, transactions],
  )

  const gridCells = useMemo(() => {
    const offset = firstWeekday(viewMonth)
    const days = daysInMonth(viewMonth)
    const cells: Array<{ date: string | null }> = []
    for (let i = 0; i < offset; i += 1) cells.push({ date: null })
    for (let day = 1; day <= days; day += 1) {
      cells.push({ date: `${viewMonth}-${String(day).padStart(2, "0")}` })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [viewMonth])

  const selectedTxs = selectedDay ? txByDay[selectedDay] ?? [] : []
  const selectedEvents = selectedDay ? eventByDay[selectedDay] ?? [] : []
  const today = todayString()

  const yearMonths = useMemo(() => {
    const year = viewMonth.slice(0, 4)
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
  }, [viewMonth])

  const maxYearExpense = useMemo(() => {
    const max = yearMonths.reduce((result, monthKey) => {
      const monthExpense = transactions
        .filter((tx) => tx.date.startsWith(monthKey) && tx.type === "expense")
        .reduce((sum, tx) => sum + tx.amount, 0)
      return Math.max(result, monthExpense)
    }, 0)
    return max || 1
  }, [transactions, yearMonths])

  function formatMonthLabel(monthKey: string) {
    return lang === "en" ? monthKey : `${monthKey.slice(0, 4)}年${Number(monthKey.slice(5))}月`
  }

  function dayNet(date: string) {
    return (txByDay[date] ?? []).reduce((sum, tx) => {
      if (tx.type === "income") return sum + tx.amount
      if (tx.type === "expense") return sum - tx.amount
      return sum
    }, 0)
  }

  function addEvent() {
    if (!selectedDay || !form.title.trim()) return
    const nextEvent: CalendarEvent = {
      id: createId(),
      date: selectedDay,
      title: form.title.trim(),
      note: form.note.trim(),
      amount: form.amount ? Number(form.amount) : null,
      type: form.type,
    }
    persistEvents([nextEvent, ...events])
    setForm({ title: "", note: "", amount: "", type: "reminder" })
    setShowForm(false)
  }

  function deleteEvent(id: string) {
    persistEvents(events.filter((event) => event.id !== id))
  }

  async function fetchAIAdvice() {
    setAiLoading(true)
    setAiError(null)
    try {
      const categoryExpenses: Record<string, number> = {}
      transactions
        .filter((tx) => tx.date.startsWith(viewMonth) && tx.type === "expense")
        .forEach((tx) => {
          categoryExpenses[tx.category] = (categoryExpenses[tx.category] ?? 0) + tx.amount
        })

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "calendar_advice",
          provider: aiProvider,
          data: {
            currentMonth: viewMonth,
            monthlyData: stripStats.map((item) => ({
              ym: item.monthKey,
              income: item.income,
              expense: item.expense,
              balance: item.balance,
              eventCount: item.eventCount,
            })),
            categoryExpenses,
            eventCount: events.filter((event) => event.date.startsWith(viewMonth)).length,
          },
        }),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? t("AI分析に失敗しました。", "AI analysis failed."))
      const parsed = typeof json.result === "string" ? parseCalendarAIResult(json.result) : (json.result as CalendarAIResult)
      setAiResult(parsed)
      setShowAI(true)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("エラーが発生しました。", "An error occurred."))
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl border border-slate-700 bg-slate-900 p-1.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`min-w-20 rounded-xl px-4 py-3 text-sm font-semibold transition ${viewMode === "grid" ? "bg-cyan-400 text-slate-950 shadow-sm" : "text-slate-300 hover:text-white"}`}
          >
            {t("月", "Month")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("year")}
            className={`min-w-20 rounded-xl px-4 py-3 text-sm font-semibold transition ${viewMode === "year" ? "bg-cyan-400 text-slate-950 shadow-sm" : "text-slate-300 hover:text-white"}`}
          >
            {t("年", "Year")}
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1.5">
          <button
            type="button"
            aria-label={t("前へ", "Previous")}
            onClick={() => { setViewMonth(addMonths(viewMonth, viewMode === "grid" ? -1 : -12)); setSelectedDay(null) }}
            className="rounded-xl px-3 py-3 text-base font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            ‹
          </button>
          <span className="min-w-28 text-center text-sm font-semibold tracking-[0.08em] text-slate-100">{viewMode === "grid" ? formatMonthLabel(viewMonth) : viewMonth.slice(0, 4)}</span>
          <button
            type="button"
            aria-label={t("次へ", "Next")}
            onClick={() => { setViewMonth(addMonths(viewMonth, viewMode === "grid" ? 1 : 12)); setSelectedDay(null) }}
            className="rounded-xl px-3 py-3 text-base font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2">
          <span className="text-xs font-medium text-slate-400">{t("AI", "AI")}</span>
          {AI_PROVIDERS.map((provider) => (
            <button
              key={provider.key}
              type="button"
              onClick={() => setAIProvider(provider.key)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                aiProvider === provider.key
                  ? `${provider.color} text-white`
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {provider.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={fetchAIAdvice}
          disabled={aiLoading}
          className="ml-auto rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {aiLoading ? t("分析中...", "Analyzing...") : t("AIで予定を見る", "AI calendar advice")}
        </button>
      </div>

      {(showAI || aiLoading || aiError) && (
        <div className="rounded-[24px] border border-cyan-800 bg-cyan-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-cyan-100">{t("AIからの提案", "AI suggestions")}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{aiProvider}</span>
              {showAI && (
                <button type="button" onClick={() => setShowAI(false)} className="text-sm text-slate-400 hover:text-white">
                  {t("閉じる", "Close")}
                </button>
              )}
            </div>
          </div>
          {aiLoading && <p className="mt-3 text-sm text-slate-300">{t("分析中です...", "Analyzing...")}</p>}
          {aiError && <p className="mt-3 text-sm text-rose-200">{aiError}</p>}
          {showAI && aiResult && (
            <div className="mt-3 space-y-3 text-sm text-slate-200">
              <div className="rounded-2xl bg-slate-900 p-3">{aiResult.month_summary}</div>
              {aiResult.calendar_tips?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm uppercase tracking-[0.16em] text-slate-400">{t("使い方のコツ", "Tips")}</p>
                  <div className="space-y-2">
                    {aiResult.calendar_tips.map((tip) => (
                      <div key={tip} className="rounded-2xl bg-slate-900 px-3 py-2">{tip}</div>
                    ))}
                  </div>
                </div>
              )}
              {aiResult.upcoming_warnings?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm uppercase tracking-[0.16em] text-slate-400">{t("気をつけたい点", "Warnings")}</p>
                  <div className="space-y-2">
                    {aiResult.upcoming_warnings.map((warning) => (
                      <div key={warning} className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-amber-100">{warning}</div>
                    ))}
                  </div>
                </div>
              )}
              {aiResult.best_saving_day && (
                <div className="rounded-2xl border border-emerald-800 bg-emerald-950 px-3 py-2">
                  <p className="text-sm uppercase tracking-[0.16em] text-emerald-200">{t("節約に向く日", "Best saving day")}</p>
                  <p className="mt-1">{aiResult.best_saving_day}</p>
                </div>
              )}
              {aiResult.annual_pattern && (
                <div className="rounded-2xl bg-slate-900 px-3 py-2">
                  <p className="text-sm uppercase tracking-[0.16em] text-slate-400">{t("1年の流れ", "Annual pattern")}</p>
                  <p className="mt-1">{aiResult.annual_pattern}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === "grid" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-white/10">
              {WEEKDAYS[lang].map((weekday) => (
                <div key={weekday} className="py-2 text-center text-sm font-medium text-slate-400">{weekday}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridCells.map((cell, index) => {
                if (!cell.date) {
                  return <div key={`empty-${index}`} className="h-20 border-b border-r border-white/5" />
                }
                const day = cell.date
                const txs = txByDay[day] ?? []
                const dayEvents = eventByDay[day] ?? []
                const net = dayNet(day)
                const isToday = day === today
                const isSelected = day === selectedDay
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => { setSelectedDay(isSelected ? null : day); setShowForm(false) }}
                    className={`flex h-20 flex-col items-start border-b border-r border-slate-800 p-2 text-left transition ${isSelected ? "bg-cyan-950" : "hover:bg-slate-800"}`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-cyan-400 text-slate-950" : "text-slate-200"}`}>{Number(day.slice(-2))}</span>
                    <div className="mt-auto flex flex-wrap gap-1">
                      {txs.length > 0 && <span className={`h-1.5 w-1.5 rounded-full ${net >= 0 ? "bg-emerald-400" : "bg-rose-400"}`} />}
                      {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${EVENT_META[event.type].dot}`} />)}
                    </div>
                    {txs.length > 0 && (
                      <span className={`mt-1 text-[10px] font-medium ${net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{shortCurrency(Math.abs(net))}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-700 bg-slate-900 p-4">
              <h3 className="text-base font-bold text-white">{t("月のサマリー", "Monthly summary")}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: t("収入", "Income"), value: monthSummary.income, tone: "text-emerald-300" },
                  { label: t("支出", "Expense"), value: monthSummary.expense, tone: "text-orange-300" },
                  { label: t("貯蓄", "Saving"), value: monthSummary.saving, tone: "text-cyan-300" },
                  { label: t("差額", "Balance"), value: monthSummary.balance, tone: monthSummary.balance >= 0 ? "text-white" : "text-rose-300" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-950 p-3">
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className={`mt-2 text-sm font-semibold ${item.tone}`}>{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-white">{selectedDay ? selectedDay.replace(/-/g, "/") : t("日付をえらぶ", "Select a date")}</h3>
                {selectedDay && (
                  <button type="button" onClick={() => setShowForm((prev) => !prev)} className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
                    {showForm ? t("閉じる", "Close") : t("予定を追加", "Add event")}
                  </button>
                )}
              </div>

              {!selectedDay && <p className="mt-3 text-sm text-slate-400">{t("日付を押すと、その日の取引と予定を見られます。", "Select a date to view transactions and events.")}</p>}

              {selectedDay && (
                <div className="mt-3 space-y-3">
                  {showForm && (
                    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(EVENT_META) as EventType[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, type: key }))}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${form.type === key ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}
                          >
                            {EVENT_META[key][lang]}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2">
                        <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("タイトル", "Title")} className="rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} type="number" placeholder={t("金額", "Amount")} className="rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                          <input value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} placeholder={t("メモ", "Note")} className="rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                        </div>
                        <button type="button" onClick={addEvent} disabled={!form.title.trim()} className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40">
                          {t("保存", "Save")}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedEvents.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm uppercase tracking-[0.16em] text-slate-500">{t("予定", "Events")}</p>
                      <div className="space-y-2">
                        {selectedEvents.map((event) => (
                          <div key={event.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-950 px-3 py-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${EVENT_META[event.type].color}`}>{EVENT_META[event.type][lang]}</span>
                                <span className="text-sm text-white">{event.title}</span>
                              </div>
                              {event.amount != null && <p className="mt-1 text-xs text-slate-300">{formatCurrency(event.amount)}</p>}
                              {event.note && <p className="mt-1 text-xs text-slate-500">{event.note}</p>}
                            </div>
                            <button type="button" onClick={() => deleteEvent(event.id)} className="text-xs text-slate-500 hover:text-rose-300">{t("削除", "Delete")}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTxs.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm uppercase tracking-[0.16em] text-slate-500">{t("取引", "Transactions")}</p>
                      <div className="space-y-2">
                        {selectedTxs.map((tx) => {
                          const meta = TX_META[tx.type]
                          return (
                            <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950 px-3 py-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-semibold ${meta.tone}`}>{meta[lang]}</span>
                                  <span className="truncate text-sm text-white">{getCategoryLabel(tx.category, lang)}</span>
                                </div>
                                {tx.memo && <p className="mt-1 truncate text-xs text-slate-500">{tx.memo}</p>}
                              </div>
                              <span className={`shrink-0 text-sm font-semibold ${meta.tone}`}>{meta.sign}{formatCurrency(tx.amount)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {selectedEvents.length === 0 && selectedTxs.length === 0 && (
                    <p className="text-sm text-slate-400">{t("この日の予定も取引もまだありません。", "No events or transactions for this date yet.")}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {yearMonths.map((monthKey) => {
              const monthTx = transactions.filter((tx) => tx.date.startsWith(monthKey))
              const income = monthTx.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0)
              const expense = monthTx.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0)
              const saving = monthTx.filter((tx) => tx.type === "saving" || tx.type === "investment").reduce((sum, tx) => sum + tx.amount, 0)
              const balance = income - expense - saving
              const eventCount = events.filter((event) => event.date.startsWith(monthKey)).length
              return (
                <button
                  key={monthKey}
                  type="button"
                  onClick={() => { setViewMonth(monthKey); setViewMode("grid"); setSelectedDay(null) }}
                  className={`rounded-[24px] border p-4 text-left transition ${monthKey === viewMonth ? "border-cyan-500 bg-cyan-950" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{formatMonthLabel(monthKey)}</p>
                    {eventCount > 0 && <span className="text-[10px] text-sky-300">{eventCount}{t("件", " events")}</span>}
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400"><span>{t("収入", "Income")}</span><span>{shortCurrency(income)}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.round((income / maxYearExpense) * 100))}%` }} /></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400"><span>{t("支出", "Expense")}</span><span>{shortCurrency(expense)}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${Math.min(100, Math.round((expense / maxYearExpense) * 100))}%` }} /></div>
                    </div>
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${balance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{t("差額", "Balance")}: {formatCurrency(balance)}</p>
                </button>
              )
            })}
          </div>

          <div className="rounded-[24px] border border-slate-700 bg-slate-900 p-4">
            <h3 className="text-base font-bold text-white">{t("1年のまとめ", "Annual summary")}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t("年間収入", "Annual income"), value: stripStats.reduce((sum, item) => sum + item.income, 0), tone: "text-emerald-300" },
                { label: t("年間支出", "Annual expense"), value: stripStats.reduce((sum, item) => sum + item.expense, 0), tone: "text-orange-300" },
                { label: t("年間差額", "Annual balance"), value: stripStats.reduce((sum, item) => sum + item.balance, 0), tone: "text-white" },
                { label: t("予定の数", "Events"), value: stripStats.reduce((sum, item) => sum + item.eventCount, 0), tone: "text-sky-300", plain: true },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-950 p-3">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className={`mt-2 text-sm font-semibold ${item.tone}`}>{item.plain ? item.value : formatCurrency(Number(item.value))}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
