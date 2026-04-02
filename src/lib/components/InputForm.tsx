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
    onSuccess(data)
    setAmount("")
    setMemo("")
    setCategory("")
  }

  const currentCategories = CATEGORIES[tab === "fixed" ? "expense" : (tab as keyof typeof CATEGORIES)] ?? []

  return (
    <div className="space-y-4 animate-slide-up">
      {/* タブ */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setCategory("") }}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg text-xs transition-all ${
              tab === t.key ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.emoji}</span>
            <span className="mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 金額 */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">入力ステップ（円）</p>
        <div className="flex gap-1">
          {STEPS.map(s => (
            <button
              key={s.value}
              onClick={() => setAmountStep(s.value)}
              className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                amountStep === s.value ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          step={amountStep}
          min={0}
          placeholder="金額"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-violet-500"
        />
        <div className="flex gap-1">
          {UNITS.map(u => (
            <button
              key={u.label}
              onClick={() => setUnit(u.factor)}
              className={`px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                unit === u.factor ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* メモ & AIカテゴリ推測 */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="メモ（例：スーパー、電車代）"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={aiGuessCategory}
          disabled={aiLoading || !memo}
          className="px-3 py-3 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-xl text-sm transition-all"
          title="AIがカテゴリを推測"
        >
          {aiLoading ? "⏳" : "🤖"}
        </button>
      </div>

      {/* よく使うカテゴリ */}
      {recentCategories.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">🕐 最近使ったカテゴリ</p>
          <div className="flex flex-wrap gap-1.5">
            {recentCategories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-xs border transition-all ${
                  category === c ? "bg-violet-600 border-violet-500 text-white" : "border-slate-600 text-slate-400 hover:border-slate-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* カテゴリ選択 */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">カテゴリ</p>
        <div className="grid grid-cols-3 gap-1.5">
          {currentCategories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`py-2 rounded-lg text-xs border transition-all ${
                category === c ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 支払方法 */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">支払方法</p>
        <div className="flex gap-1.5 flex-wrap">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m}
              onClick={() => setPayment(m)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                payment === m ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 text-slate-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 日付 & 固定費フラグ */}
      <div className="flex gap-3 items-center">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
        />
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400">
          <input
            type="checkbox"
            checked={isFixed}
            onChange={e => setIsFixed(e.target.checked)}
            className="w-4 h-4 accent-violet-500"
          />
          固定費
        </label>
      </div>

      {/* 送信 */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold text-lg transition-all"
      >
        {loading ? "保存中..." : "💾 保存する"}
      </button>
    </div>
  )
}
