"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CATEGORIES, PAYMENT_METHODS, TabType, Transaction } from "@/lib/utils"

interface Props {
  onSuccess: (tx: Transaction) => void
  recentTransactions: Transaction[]
}

const UNITS = [
  { label: "円", factor: 1 },
  { label: "千円", factor: 1000 },
  { label: "万円", factor: 10000 },
]

const STEPS = [
  { label: "1", value: 1 },
  { label: "10", value: 10 },
  { label: "100", value: 100 },
  { label: "1000", value: 1000 },
]

export default function InputForm({ onSuccess, recentTransactions }: Props) {
  const [tab, setTab] = useState<TabType>("expense")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState(1)
  const [amountStep, setAmountStep] = useState(1)
  const [category, setCategory] = useState("")
  const [memo, setMemo] = useState("")
  const [payment, setPayment] = useState("カード")
  const [isFixed, setIsFixed] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const tabs: { key: TabType; label: string; emoji: string }[] = [
    { key: "income", label: "収入", emoji: "💰" },
    { key: "expense", label: "支出", emoji: "💸" },
    { key: "saving", label: "貯金", emoji: "🏦" },
    { key: "investment", label: "投資", emoji: "📈" },
    { key: "fixed", label: "固定費", emoji: "🔒" },
  ]

  // よく使うカテゴリ（履歴から）
  const recentCategories = [...new Set(
    recentTransactions.filter(t => t.type === tab).map(t => t.category)
  )].slice(0, 5)

  async function aiGuessCategory() {
    if (!memo) return
    setAiLoading(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "category",
          data: {
            memo,
            transactionType: tab,
            categories: CATEGORIES[tab === "fixed" ? "expense" : tab] ?? CATEGORIES.expense,
          },
        }),
      })
      const { result } = await res.json()
      if (result) setCategory(result.trim())
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert("ログインしてください"); return }
    if (!amount || !category) { alert("金額とカテゴリを入力してください"); return }

    setLoading(true)
    const realAmount = Number(amount) * unit
    const type: TabType = tab === "fixed" ? "expense" : tab

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type,
        amount: realAmount,
        category,
        memo,
        payment_method: payment,
        is_fixed: isFixed || tab === "fixed",
        date,
      })
      .select()
      .single()

    setLoading(false)
    if (error) { alert("保存失敗: " + error.message); return }
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("kakeibo-just-saved", "1")
    }
    onSuccess(data)
    setAmount("")
    setMemo("")
    setCategory("")
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const currentCategories = CATEGORIES[tab === "fixed" ? "expense" : (tab as keyof typeof CATEGORIES)] ?? []

  return (
    <div className="animate-slide-up flex flex-col gap-2">

      {/* タブ */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setCategory("") }}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-lg text-xs transition-all ${
              tab === t.key ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.emoji}</span>
            <span className="mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 金額 + 単位 */}
      <div className="flex gap-1">
        <input
          type="number"
          step={amountStep}
          min={0}
          placeholder="金額"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-lg font-bold focus:outline-none focus:border-violet-500"
        />
        {UNITS.map(u => (
          <button
            key={u.label}
            type="button"
            onClick={() => setUnit(u.factor)}
            className={`px-2 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
              unit === u.factor ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {u.label}
          </button>
        ))}
      </div>

      {/* 入力ステップ */}
      <div className="flex gap-1">
        {STEPS.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => setAmountStep(s.value)}
            className={`flex-1 py-1 rounded-lg text-xs border transition-all ${
              amountStep === s.value ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* メモ & AIカテゴリ推測 */}
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="メモ（例：スーパー、電車代）"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
        />
        <button
          type="button"
          onClick={aiGuessCategory}
          disabled={aiLoading || !memo}
          className="px-3 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-xl text-sm transition-all shrink-0"
          title="AIがカテゴリを推測"
        >
          {aiLoading ? "⏳" : "🤖"}
        </button>
      </div>

      {/* カテゴリ選択 */}
      <div>
        <p className="text-xs text-slate-500 mb-1">
          カテゴリ
          {recentCategories.length > 0 && (
            <span className="ml-2 text-slate-600">最近: </span>
          )}
          {recentCategories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`ml-1 px-1.5 py-0.5 rounded-full text-xs border transition-all ${
                category === c ? "bg-violet-600 border-violet-500 text-white" : "border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300"
              }`}
            >
              {c}
            </button>
          ))}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {currentCategories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`py-1.5 rounded-lg text-xs border transition-all truncate px-1 ${
                category === c ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 支払方法 */}
      <div className="flex gap-1 flex-wrap">
        {PAYMENT_METHODS.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setPayment(m)}
            className={`px-2 py-1 rounded-lg text-xs border transition-all ${
              payment === m ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* 日付 & 固定費フラグ */}
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
        />
        <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-400 shrink-0">
          <input
            type="checkbox"
            checked={isFixed}
            onChange={e => setIsFixed(e.target.checked)}
            className="w-4 h-4 accent-violet-500"
          />
          固定費
        </label>
      </div>

      {/* 保存フィードバック */}
      {savedFlash && (
        <div className="text-center text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 rounded-xl py-2 animate-fade-in">
          ✅ 保存しました！
        </div>
      )}

      {/* 保存ボタン */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold text-sm transition-all"
      >
        {loading ? "保存中..." : "💾 保存する"}
      </button>

    </div>
  )
}
