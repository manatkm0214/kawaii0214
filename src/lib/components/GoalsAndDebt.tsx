"use client"

import { Transaction, formatCurrency } from "@/lib/utils"
import { useState, useMemo, useCallback } from "react"

// ── 型定義 ──────────────────────────────────────────────────────────────────

interface Debt {
  id: string
  name: string
  type: "loan" | "mortgage" | "credit" | "other"
  totalAmount: number
  remainingAmount: number
  monthlyPayment: number
  interestRate: number  // 年利 %
  memo: string
}

interface SinkingFund {
  id: string
  name: string
  emoji: string
  targetAmount: number
  currentAmount: number
  targetDate: string  // YYYY-MM
  memo: string
}

interface PersonalGoal {
  id: string
  name: string
  emoji: string
  targetAmount: number
  currentAmount: number
  memo: string
}

// ── Storage Keys ────────────────────────────────────────────────────────────

const KEY_DEBTS = "kakeibo-debts"
const KEY_SINKING = "kakeibo-sinking-funds"
const KEY_GOALS = "kakeibo-personal-goals"
const KEY_TICKET_VALUE = "kakeibo-ticket-value"
const KEY_TICKETS_USED = "kakeibo-tickets-used"

// ── Helpers ─────────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function save(key: string, value: unknown) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number)
  const [ty, tm] = to.split("-").map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ── 徳ポイント計算 ────────────────────────────────────────────────────────────

function calcVirtuePoints(transactions: Transaction[]): { total: number; byMonth: { ym: string; points: number; reasons: string[] }[] } {
  const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort()
  const byMonth = months.map(ym => {
    const txs = transactions.filter(t => t.date.startsWith(ym))
    const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const saving = txs.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
    const investment = txs.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
    const fixed = txs.filter(t => t.is_fixed && t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const balance = income - expense - saving - investment
    const savingRate = income > 0 ? (saving + investment) / income * 100 : 0
    const fixedRate = income > 0 ? fixed / income * 100 : 100
    const variableRate = income > 0 ? (expense - fixed) / income * 100 : 100

    const reasons: string[] = []
    let points = 0

    if (income > 0) {
      if (savingRate >= 20) { points += 10; reasons.push("貯蓄率20%以上 +10") }
      else if (savingRate >= 10) { points += 5; reasons.push("貯蓄率10%以上 +5") }
      if (balance > 0) { points += 5; reasons.push("黒字 +5") }
      if (fixedRate <= 35) { points += 3; reasons.push("固定費率35%以下 +3") }
      if (variableRate <= 25) { points += 5; reasons.push("変動費率25%以下 +5") }
      if (saving + investment > 0) { points += 2; reasons.push("貯金・投資あり +2") }
    }

    return { ym, points, reasons }
  })
  const total = byMonth.reduce((s, m) => s + m.points, 0)
  return { total, byMonth }
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function GoalsAndDebt({ transactions, currentMonth }: Props) {
  const [tab, setTab] = useState<"debt" | "sinking" | "goals" | "virtue">("debt")

  // 借金・ローン
  const [debts, setDebts] = useState<Debt[]>(() => load(KEY_DEBTS, []))
  const [showDebtForm, setShowDebtForm] = useState(false)
  const [debtForm, setDebtForm] = useState<Omit<Debt, "id">>({
    name: "", type: "loan", totalAmount: 0, remainingAmount: 0, monthlyPayment: 0, interestRate: 0, memo: ""
  })
  const [editDebtId, setEditDebtId] = useState<string | null>(null)

  // 先取積み立て
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>(() => load(KEY_SINKING, []))
  const [showSinkingForm, setShowSinkingForm] = useState(false)
  const [sinkingForm, setSinkingForm] = useState<Omit<SinkingFund, "id">>({
    name: "", emoji: "💰", targetAmount: 0, currentAmount: 0, targetDate: addMonths(today(), 12), memo: ""
  })
  const [editSinkingId, setEditSinkingId] = useState<string | null>(null)

  // 推し活・目標貯金
  const [goals, setGoals] = useState<PersonalGoal[]>(() => load(KEY_GOALS, []))
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState<Omit<PersonalGoal, "id">>({
    name: "", emoji: "⭐", targetAmount: 0, currentAmount: 0, memo: ""
  })
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [ticketValue, setTicketValue] = useState<number>(() => load(KEY_TICKET_VALUE, 1000))
  const [ticketsUsed, setTicketsUsed] = useState<number>(() => load(KEY_TICKETS_USED, 0))

  // ── 徳ポイント ────────────────────────────────────────────────────────────
  const virtue = useMemo(() => calcVirtuePoints(transactions), [transactions])
  const ticketsEarned = Math.floor(virtue.total / 100)
  const ticketsAvailable = Math.max(0, ticketsEarned - ticketsUsed)

  // ── 借金操作 ────────────────────────────────────────────────────────────
  const saveDebts = useCallback((next: Debt[]) => { setDebts(next); save(KEY_DEBTS, next) }, [])

  function submitDebt() {
    if (!debtForm.name.trim()) return
    if (editDebtId) {
      saveDebts(debts.map(d => d.id === editDebtId ? { id: editDebtId, ...debtForm } : d))
    } else {
      saveDebts([...debts, { id: newId(), ...debtForm }])
    }
    setDebtForm({ name: "", type: "loan", totalAmount: 0, remainingAmount: 0, monthlyPayment: 0, interestRate: 0, memo: "" })
    setEditDebtId(null)
    setShowDebtForm(false)
  }

  function deleteDebt(id: string) { saveDebts(debts.filter(d => d.id !== id)) }

  function editDebt(d: Debt) {
    setDebtForm({ name: d.name, type: d.type, totalAmount: d.totalAmount, remainingAmount: d.remainingAmount, monthlyPayment: d.monthlyPayment, interestRate: d.interestRate, memo: d.memo })
    setEditDebtId(d.id)
    setShowDebtForm(true)
  }

  function payDebt(id: string) {
    // 返済ボタン: 残高から月々返済額を引く
    saveDebts(debts.map(d => {
      if (d.id !== id) return d
      const next = Math.max(0, d.remainingAmount - d.monthlyPayment)
      return { ...d, remainingAmount: next }
    }))
  }

  // ── 先取積み立て操作 ──────────────────────────────────────────────────────
  const saveSinking = useCallback((next: SinkingFund[]) => { setSinkingFunds(next); save(KEY_SINKING, next) }, [])

  function submitSinking() {
    if (!sinkingForm.name.trim()) return
    if (editSinkingId) {
      saveSinking(sinkingFunds.map(s => s.id === editSinkingId ? { id: editSinkingId, ...sinkingForm } : s))
    } else {
      saveSinking([...sinkingFunds, { id: newId(), ...sinkingForm }])
    }
    setSinkingForm({ name: "", emoji: "💰", targetAmount: 0, currentAmount: 0, targetDate: addMonths(today(), 12), memo: "" })
    setEditSinkingId(null)
    setShowSinkingForm(false)
  }

  function deleteSinking(id: string) { saveSinking(sinkingFunds.filter(s => s.id !== id)) }

  function editSinking(s: SinkingFund) {
    setSinkingForm({ name: s.name, emoji: s.emoji, targetAmount: s.targetAmount, currentAmount: s.currentAmount, targetDate: s.targetDate, memo: s.memo })
    setEditSinkingId(s.id)
    setShowSinkingForm(true)
  }

  function addToSinking(id: string, amount: number) {
    saveSinking(sinkingFunds.map(s => s.id === id ? { ...s, currentAmount: Math.min(s.targetAmount, s.currentAmount + amount) } : s))
  }

  // ── 個人目標操作 ──────────────────────────────────────────────────────────
  const saveGoals = useCallback((next: PersonalGoal[]) => { setGoals(next); save(KEY_GOALS, next) }, [])

  function submitGoal() {
    if (!goalForm.name.trim()) return
    if (editGoalId) {
      saveGoals(goals.map(g => g.id === editGoalId ? { id: editGoalId, ...goalForm } : g))
    } else {
      saveGoals([...goals, { id: newId(), ...goalForm }])
    }
    setGoalForm({ name: "", emoji: "⭐", targetAmount: 0, currentAmount: 0, memo: "" })
    setEditGoalId(null)
    setShowGoalForm(false)
  }

  function deleteGoal(id: string) { saveGoals(goals.filter(g => g.id !== id)) }

  function editGoal(g: PersonalGoal) {
    setGoalForm({ name: g.name, emoji: g.emoji, targetAmount: g.targetAmount, currentAmount: g.currentAmount, memo: g.memo })
    setEditGoalId(g.id)
    setShowGoalForm(true)
  }

  function useTicketOnGoal(goalId: string) {
    if (ticketsAvailable <= 0) return
    const next = goals.map(g => g.id === goalId ? { ...g, currentAmount: Math.min(g.targetAmount || Infinity, g.currentAmount + ticketValue) } : g)
    saveGoals(next)
    const nextUsed = ticketsUsed + 1
    setTicketsUsed(nextUsed)
    save(KEY_TICKETS_USED, nextUsed)
  }

  function addManualToGoal(goalId: string, amount: number) {
    saveGoals(goals.map(g => g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g))
  }

  const DEBT_TYPE_LABEL: Record<Debt["type"], string> = {
    loan: "ローン", mortgage: "住宅ローン", credit: "クレジット", other: "その他"
  }

  const EMOJI_OPTIONS = ["⭐", "🎵", "🎤", "🎮", "✈️", "🏖️", "🎁", "💄", "👗", "📸", "🎨", "🐱", "🐶", "🍰", "💪", "📚", "🎯", "💎", "🌸", "🔥"]
  const SINKING_EMOJIS = ["💰", "🚗", "✈️", "🏠", "🏥", "📱", "💻", "🎒", "🔧", "🎄", "🎓", "🌿"]

  return (
    <div className="flex flex-col gap-3">

      {/* タブ */}
      <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
        {([
          { key: "debt", label: "💳 借金・ローン" },
          { key: "sinking", label: "🪣 先取積み立て" },
          { key: "goals", label: "⭐ 推し活・目標" },
          { key: "virtue", label: "🙏 徳ポイント" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
          >{label}</button>
        ))}
      </div>

      {/* ═══════════ 借金・ローン ═══════════ */}
      {tab === "debt" && (
        <div className="flex flex-col gap-2">
          {/* サマリー */}
          {debts.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400">総残高</p>
                <p className="text-sm font-bold text-red-400">{formatCurrency(debts.reduce((s, d) => s + d.remainingAmount, 0))}</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400">月々返済合計</p>
                <p className="text-sm font-bold text-orange-400">{formatCurrency(debts.reduce((s, d) => s + d.monthlyPayment, 0))}</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400">完済数</p>
                <p className="text-sm font-bold text-emerald-400">{debts.filter(d => d.remainingAmount <= 0).length} / {debts.length}</p>
              </div>
            </div>
          )}

          {/* 借金リスト */}
          {debts.map(d => {
            const pct = d.totalAmount > 0 ? Math.round((1 - d.remainingAmount / d.totalAmount) * 100) : 100
            const monthsLeft = d.monthlyPayment > 0 ? Math.ceil(d.remainingAmount / d.monthlyPayment) : null
            const eta = monthsLeft != null ? addMonths(today(), monthsLeft) : null
            const done = d.remainingAmount <= 0
            return (
              <div key={d.id} className={`bg-slate-800/60 border rounded-xl p-3 ${done ? "border-emerald-700/40" : "border-slate-700/50"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{d.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{DEBT_TYPE_LABEL[d.type]}</span>
                      {done && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/40 text-emerald-300">完済！🎉</span>}
                    </div>
                    {d.memo && <p className="text-[10px] text-slate-500 mt-0.5">{d.memo}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!done && <button type="button" onClick={() => payDebt(d.id)} className="px-2 py-1 text-[10px] bg-emerald-700/30 hover:bg-emerald-600/40 text-emerald-300 rounded-lg border border-emerald-700/40 transition-colors">返済</button>}
                    <button type="button" onClick={() => editDebt(d)} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">編集</button>
                    <button type="button" onClick={() => deleteDebt(d.id)} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-200 rounded-lg transition-colors">削除</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500">残高</p>
                    <p className={`font-semibold ${done ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(d.remainingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">月々</p>
                    <p className="font-semibold text-orange-400">{formatCurrency(d.monthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">完済予定</p>
                    <p className="font-semibold text-sky-400">
                      {done ? "完済" : eta ? `${eta.replace("-", "年")}月` : "−"}
                    </p>
                  </div>
                </div>
                {/* カウントダウン */}
                {!done && monthsLeft != null && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-slate-500 shrink-0">完済まで</span>
                    <span className="text-sm font-black text-violet-300">あと {monthsLeft} ヶ月</span>
                  </div>
                )}
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${done ? "bg-emerald-500" : pct > 70 ? "bg-sky-500" : pct > 40 ? "bg-violet-500" : "bg-orange-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">返済率 {pct}%{d.interestRate > 0 ? ` ・ 年利 ${d.interestRate}%` : ""}</p>
              </div>
            )
          })}

          {/* 追加フォーム */}
          {showDebtForm ? (
            <div className="bg-slate-800/60 border border-violet-700/40 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-200">{editDebtId ? "借金・ローンを編集" : "借金・ローンを追加"}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text" placeholder="名前（例: 車ローン）"
                  value={debtForm.name} onChange={e => setDebtForm(f => ({ ...f, name: e.target.value }))}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <select
                  value={debtForm.type} onChange={e => setDebtForm(f => ({ ...f, type: e.target.value as Debt["type"] }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="loan">ローン</option>
                  <option value="mortgage">住宅ローン</option>
                  <option value="credit">クレジット</option>
                  <option value="other">その他</option>
                </select>
                <input
                  type="number" placeholder="年利 (%)"
                  value={debtForm.interestRate || ""} onChange={e => setDebtForm(f => ({ ...f, interestRate: Number(e.target.value) }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input
                  type="number" placeholder="借入総額"
                  value={debtForm.totalAmount || ""} onChange={e => setDebtForm(f => ({ ...f, totalAmount: Number(e.target.value) }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input
                  type="number" placeholder="現在の残高"
                  value={debtForm.remainingAmount || ""} onChange={e => setDebtForm(f => ({ ...f, remainingAmount: Number(e.target.value) }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input
                  type="number" placeholder="月々の返済額"
                  value={debtForm.monthlyPayment || ""} onChange={e => setDebtForm(f => ({ ...f, monthlyPayment: Number(e.target.value) }))}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text" placeholder="メモ（任意）"
                  value={debtForm.memo} onChange={e => setDebtForm(f => ({ ...f, memo: e.target.value }))}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitDebt} disabled={!debtForm.name.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-all">
                  {editDebtId ? "更新" : "追加"}
                </button>
                <button type="button" onClick={() => { setShowDebtForm(false); setEditDebtId(null) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-all">キャンセル</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowDebtForm(true)} className="w-full py-2 border border-dashed border-slate-600 hover:border-violet-500 text-slate-400 hover:text-violet-300 rounded-xl text-sm transition-all">
              ＋ 借金・ローンを追加
            </button>
          )}
        </div>
      )}

      {/* ═══════════ 先取積み立て ═══════════ */}
      {tab === "sinking" && (
        <div className="flex flex-col gap-2">
          {/* サマリー */}
          {sinkingFunds.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400">目標合計</p>
                <p className="text-sm font-bold text-emerald-400">{formatCurrency(sinkingFunds.reduce((s, f) => s + f.targetAmount, 0))}</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400">積立済み</p>
                <p className="text-sm font-bold text-sky-400">{formatCurrency(sinkingFunds.reduce((s, f) => s + f.currentAmount, 0))}</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400">達成数</p>
                <p className="text-sm font-bold text-violet-400">{sinkingFunds.filter(f => f.currentAmount >= f.targetAmount).length} / {sinkingFunds.length}</p>
              </div>
            </div>
          )}

          {sinkingFunds.length === 0 && !showSinkingForm && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p className="text-2xl mb-2">🪣</p>
              <p>車検・旅行・家電など</p>
              <p>年間の特別出費を先取り積み立て！</p>
            </div>
          )}

          {sinkingFunds.map(f => {
            const pct = f.targetAmount > 0 ? Math.min(100, Math.round((f.currentAmount / f.targetAmount) * 100)) : 0
            const done = f.currentAmount >= f.targetAmount
            const monthsLeft = monthsBetween(today(), f.targetDate)
            const needed = Math.max(0, f.targetAmount - f.currentAmount)
            const monthlyNeeded = monthsLeft > 0 ? Math.ceil(needed / monthsLeft) : needed
            const [addAmt, setAddAmt] = useState("")

            return (
              <div key={f.id} className={`bg-slate-800/60 border rounded-xl p-3 ${done ? "border-emerald-700/40" : "border-slate-700/50"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{f.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{f.name}</span>
                        {done && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/40 text-emerald-300">達成！🎉</span>}
                      </div>
                      <p className="text-[10px] text-slate-500">目標: {f.targetDate.replace("-", "年")}月</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => editSinking(f)} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">編集</button>
                    <button type="button" onClick={() => deleteSinking(f.id)} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-200 rounded-lg transition-colors">削除</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500">目標</p>
                    <p className="font-semibold text-emerald-400">{formatCurrency(f.targetAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">積立済み</p>
                    <p className={`font-semibold ${done ? "text-emerald-400" : "text-sky-400"}`}>{formatCurrency(f.currentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">月々必要</p>
                    <p className="font-semibold text-orange-400">{done ? "−" : formatCurrency(monthlyNeeded)}</p>
                  </div>
                </div>

                {!done && monthsLeft > 0 && (
                  <p className="text-[10px] text-slate-500 mb-2">残り {monthsLeft} ヶ月・あと {formatCurrency(needed)} 不足</p>
                )}

                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${done ? "bg-emerald-500" : pct > 70 ? "bg-sky-500" : pct > 40 ? "bg-violet-500" : "bg-orange-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mb-2">達成率 {pct}%</p>

                {!done && (
                  <div className="flex gap-1">
                    <input
                      type="number" placeholder="積立額を入力"
                      value={addAmt}
                      onChange={e => setAddAmt(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => { if (Number(addAmt) > 0) { addToSinking(f.id, Number(addAmt)); setAddAmt("") } }}
                      className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs transition-all"
                    >積立</button>
                  </div>
                )}
                {f.memo && <p className="text-[10px] text-slate-500 mt-1">{f.memo}</p>}
              </div>
            )
          })}

          {showSinkingForm ? (
            <div className="bg-slate-800/60 border border-violet-700/40 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-200">{editSinkingId ? "先取積み立てを編集" : "先取積み立てを追加"}</p>
              <div className="flex gap-1 flex-wrap">
                {SINKING_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setSinkingForm(f => ({ ...f, emoji: e }))}
                    className={`w-8 h-8 rounded-lg text-base ${sinkingForm.emoji === e ? "bg-violet-600" : "bg-slate-800 hover:bg-slate-700"}`}>{e}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="名前（例: 車検, 旅行）"
                  value={sinkingForm.name} onChange={e => setSinkingForm(f => ({ ...f, name: e.target.value }))}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">目標金額</label>
                  <input type="number" placeholder="100000"
                    value={sinkingForm.targetAmount || ""} onChange={e => setSinkingForm(f => ({ ...f, targetAmount: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">現在の積立額</label>
                  <input type="number" placeholder="0"
                    value={sinkingForm.currentAmount || ""} onChange={e => setSinkingForm(f => ({ ...f, currentAmount: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">目標月 (YYYY-MM)</label>
                  <input type="month"
                    value={sinkingForm.targetDate} onChange={e => setSinkingForm(f => ({ ...f, targetDate: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <input type="text" placeholder="メモ（任意）"
                  value={sinkingForm.memo} onChange={e => setSinkingForm(f => ({ ...f, memo: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitSinking} disabled={!sinkingForm.name.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-all">
                  {editSinkingId ? "更新" : "追加"}
                </button>
                <button type="button" onClick={() => { setShowSinkingForm(false); setEditSinkingId(null) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-all">キャンセル</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSinkingForm(true)} className="w-full py-2 border border-dashed border-slate-600 hover:border-violet-500 text-slate-400 hover:text-violet-300 rounded-xl text-sm transition-all">
              ＋ 先取積み立てを追加
            </button>
          )}
        </div>
      )}

      {/* ═══════════ 推し活・目標貯金 ═══════════ */}
      {tab === "goals" && (
        <div className="flex flex-col gap-2">

          {/* チケット情報 */}
          <div className="bg-gradient-to-r from-violet-900/40 to-pink-900/30 border border-violet-700/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎫</span>
                <div>
                  <p className="text-xs font-semibold text-slate-200">チケット残高</p>
                  <p className="text-[10px] text-slate-400">徳ポイント100個ごとに1枚獲得</p>
                </div>
              </div>
              <span className="text-2xl font-black text-violet-300">{ticketsAvailable}枚</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span>獲得済み {ticketsEarned}枚</span>
              <span>・</span>
              <span>使用済み {ticketsUsed}枚</span>
              <span>・</span>
              <span>1チケット =</span>
              <input
                type="number"
                value={ticketValue}
                onChange={e => { const v = Number(e.target.value); if (v > 0) { setTicketValue(v); save(KEY_TICKET_VALUE, v) } }}
                className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-violet-300 text-right focus:outline-none"
              />
              <span>円</span>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-1.5 bg-violet-500" style={{ width: `${virtue.total % 100}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">次のチケットまで {100 - (virtue.total % 100)} 徳ポイント</p>
            </div>
          </div>

          {/* 目標リスト */}
          {goals.length === 0 && !showGoalForm && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p className="text-2xl mb-2">⭐</p>
              <p>推し活・ライブ・旅行・美容など</p>
              <p>楽しみのための貯金を設定！</p>
            </div>
          )}

          {goals.map(g => {
            const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
            const done = g.targetAmount > 0 && g.currentAmount >= g.targetAmount
            const [addAmt, setAddAmt] = useState("")

            return (
              <div key={g.id} className={`bg-slate-800/60 border rounded-xl p-3 ${done ? "border-pink-700/40" : "border-slate-700/50"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{g.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{g.name}</span>
                        {done && <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-700/40 text-pink-300">達成！🌸</span>}
                      </div>
                      {g.memo && <p className="text-[10px] text-slate-500">{g.memo}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => editGoal(g)} className="px-2 py-1 text-[10px] bg-slate-700/40 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">編集</button>
                    <button type="button" onClick={() => deleteGoal(g.id)} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-200 rounded-lg transition-colors">削除</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500">目標</p>
                    <p className="font-semibold text-pink-400">{g.targetAmount > 0 ? formatCurrency(g.targetAmount) : "未設定"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">貯まった</p>
                    <p className="font-semibold text-violet-400">{formatCurrency(g.currentAmount)}</p>
                  </div>
                </div>

                {g.targetAmount > 0 && (
                  <>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-2 rounded-full transition-all ${done ? "bg-pink-500" : "bg-gradient-to-r from-violet-500 to-pink-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2">達成率 {pct}% ・ あと {formatCurrency(Math.max(0, g.targetAmount - g.currentAmount))}</p>
                  </>
                )}

                <div className="flex gap-1">
                  {ticketsAvailable > 0 && !done && (
                    <button
                      type="button"
                      onClick={() => useTicketOnGoal(g.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-violet-700/40 hover:bg-violet-600/60 border border-violet-600/40 text-violet-300 rounded-lg text-[10px] transition-all"
                    >
                      🎫 チケット使用 (+{formatCurrency(ticketValue)})
                    </button>
                  )}
                  <input
                    type="number" placeholder="手動で追加"
                    value={addAmt}
                    onChange={e => setAddAmt(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => { if (Number(addAmt) > 0) { addManualToGoal(g.id, Number(addAmt)); setAddAmt("") } }}
                    className="px-3 py-1 bg-pink-600/60 hover:bg-pink-500/80 rounded-lg text-xs transition-all"
                  >追加</button>
                </div>
              </div>
            )
          })}

          {showGoalForm ? (
            <div className="bg-slate-800/60 border border-violet-700/40 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-200">{editGoalId ? "目標を編集" : "目標を追加"}</p>
              <div className="flex gap-1 flex-wrap">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setGoalForm(f => ({ ...f, emoji: e }))}
                    className={`w-8 h-8 rounded-lg text-base ${goalForm.emoji === e ? "bg-violet-600" : "bg-slate-800 hover:bg-slate-700"}`}>{e}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="目標名（例: 推し活, ライブ）"
                  value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input type="number" placeholder="目標金額（0=無制限）"
                  value={goalForm.targetAmount || ""} onChange={e => setGoalForm(f => ({ ...f, targetAmount: Number(e.target.value) }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input type="number" placeholder="現在の残高"
                  value={goalForm.currentAmount || ""} onChange={e => setGoalForm(f => ({ ...f, currentAmount: Number(e.target.value) }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <input type="text" placeholder="メモ（任意）"
                  value={goalForm.memo} onChange={e => setGoalForm(f => ({ ...f, memo: e.target.value }))}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitGoal} disabled={!goalForm.name.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-all">
                  {editGoalId ? "更新" : "追加"}
                </button>
                <button type="button" onClick={() => { setShowGoalForm(false); setEditGoalId(null) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-all">キャンセル</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowGoalForm(true)} className="w-full py-2 border border-dashed border-slate-600 hover:border-violet-500 text-slate-400 hover:text-violet-300 rounded-xl text-sm transition-all">
              ＋ 目標を追加
            </button>
          )}
        </div>
      )}

      {/* ═══════════ 徳ポイント ═══════════ */}
      {tab === "virtue" && (
        <div className="flex flex-col gap-2">

          {/* 合計 */}
          <div className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-700/40 rounded-xl p-4 text-center">
            <p className="text-3xl mb-1">🙏</p>
            <p className="text-4xl font-black text-amber-300">{virtue.total}</p>
            <p className="text-xs text-slate-400 mt-1">累計徳ポイント</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-slate-800/60 rounded-lg p-2">
                <p className="text-[10px] text-slate-400">獲得チケット</p>
                <p className="text-lg font-bold text-violet-300">🎫 {ticketsEarned}枚</p>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-2">
                <p className="text-[10px] text-slate-400">使用可能</p>
                <p className="text-lg font-bold text-pink-300">🎫 {ticketsAvailable}枚</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-2 bg-amber-500 transition-all" style={{ width: `${virtue.total % 100}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">次のチケットまで {100 - (virtue.total % 100)} ポイント</p>
            </div>
          </div>

          {/* 獲得方法説明 */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-200 mb-2">🌟 徳の積み方</p>
            <div className="space-y-1 text-xs text-slate-400">
              {[
                { label: "貯蓄率20%以上", pts: "+10" },
                { label: "変動費率25%以下", pts: "+5" },
                { label: "黒字月", pts: "+5" },
                { label: "貯金・投資あり", pts: "+2" },
                { label: "固定費率35%以下", pts: "+3" },
                { label: "貯蓄率10%以上", pts: "+5" },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center rounded bg-slate-900/40 px-2 py-1">
                  <span>{item.label}</span>
                  <span className="text-amber-400 font-semibold">{item.pts}</span>
                </div>
              ))}
              <p className="text-[10px] text-slate-500 pt-1">100ポイント貯まると🎫チケット1枚獲得！<br/>チケットは推し活・目標貯金に使えます。</p>
            </div>
          </div>

          {/* 月別徳ポイント */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-200 mb-2">📅 月別獲得履歴</p>
            {virtue.byMonth.length === 0 ? (
              <p className="text-xs text-slate-500">取引データがありません</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {[...virtue.byMonth].reverse().map(m => (
                  <div key={m.ym} className="rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-300">{m.ym.replace("-", "年")}月</span>
                      <span className={`text-sm font-bold ${m.points > 0 ? "text-amber-400" : "text-slate-500"}`}>🙏 {m.points}pt</span>
                    </div>
                    {m.reasons.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.reasons.join(" ・ ")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
