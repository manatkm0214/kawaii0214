"use client"
import { Transaction } from "../utils"
import { formatCurrency } from "../utils"

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

const SENIOR_EXPENSE_CATEGORIES = ["医療費", "薬代", "食費", "光熱費", "交通費", "日用品", "通信費", "娯楽", "その他"]
const SENIOR_INCOME_CATEGORIES = ["年金", "給料", "副業", "臨時収入", "その他"]

const CATEGORY_EMOJI: Record<string, string> = {
  "医療費": "🏥", "薬代": "💊", "食費": "🍱", "光熱費": "💡",
  "交通費": "🚌", "日用品": "🛒", "通信費": "📱", "娯楽": "🎭",
  "年金": "🏦", "給料": "💴", "副業": "💼", "臨時収入": "⭐",
  "その他": "📦",
}

const EXPENSE_COLORS = [
  "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-yellow-400",
  "bg-lime-400", "bg-teal-400", "bg-cyan-400", "bg-blue-400",
]

export default function SeniorDashboard({ transactions, currentMonth }: Props) {
  const monthly = transactions.filter(t => t.date.startsWith(currentMonth))

  const income = monthly
    .filter(t => t.type === "income")
    .reduce((s, t) => s + t.amount, 0)

  const expense = monthly
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0)

  const saving = monthly
    .filter(t => t.type === "saving")
    .reduce((s, t) => s + t.amount, 0)

  const balance = income - expense - saving

  // 医療費を別途集計
  const medical = monthly
    .filter(t => t.type === "expense" && (t.category === "医療費" || t.category === "薬代"))
    .reduce((s, t) => s + t.amount, 0)

  // カテゴリ別支出
  const expenseByCategory = monthly
    .filter(t => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})

  const sortedCategories = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const maxAmount = Math.max(...sortedCategories.map(([, v]) => v), 1)

  const [year, month] = currentMonth.split("-").map(Number)

  return (
    <div className="flex flex-col gap-5 p-2 max-w-lg mx-auto">
      {/* タイトル */}
      <div className="text-center py-2">
        <h2 className="text-2xl font-extrabold text-teal-600 dark:text-teal-300">
          {year}年 {month}月の家計
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">月間まとめ</p>
      </div>

      {/* 収入・支出・貯蓄 — 大きなカード */}
      <div className="flex flex-col gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-5 flex items-center justify-between shadow">
          <div className="flex items-center gap-3">
            <span className="text-4xl">💴</span>
            <div>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">収 入</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">年金・給与など</p>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-300">{formatCurrency(income)}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-2xl p-5 flex items-center justify-between shadow">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🛒</span>
            <div>
              <p className="text-base font-bold text-red-600 dark:text-red-300">支 出</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">生活費・医療費など</p>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-red-600 dark:text-red-300">{formatCurrency(expense)}</p>
        </div>

        {saving > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-5 flex items-center justify-between shadow">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🏦</span>
              <div>
                <p className="text-base font-bold text-blue-600 dark:text-blue-300">貯 蓄</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">今月の積立</p>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-300">{formatCurrency(saving)}</p>
          </div>
        )}
      </div>

      {/* 残高 — 大きく表示 */}
      <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${balance >= 0 ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700" : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"}`}>
        <p className="text-base font-bold text-slate-600 dark:text-slate-300 mb-2">今月の残り</p>
        <p className={`text-5xl font-extrabold ${balance >= 0 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
          {formatCurrency(balance)}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {balance >= 0 ? "黒字です。上手にやりくりできています ✅" : "赤字になっています。支出を見直しましょう ⚠️"}
        </p>
      </div>

      {/* 医療費ハイライト */}
      {medical > 0 && (
        <div className="bg-pink-50 dark:bg-pink-900/20 border-2 border-pink-200 dark:border-pink-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏥</span>
            <div>
              <p className="text-base font-bold text-pink-700 dark:text-pink-300">医療費・薬代</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">今月の医療費合計</p>
            </div>
          </div>
          <p className="text-2xl font-extrabold text-pink-600 dark:text-pink-300">{formatCurrency(medical)}</p>
        </div>
      )}

      {/* 支出内訳 */}
      {sortedCategories.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow border border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200 mb-4">📋 支出の内訳</h3>
          <div className="flex flex-col gap-4">
            {sortedCategories.map(([cat, amt], i) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-bold text-slate-700 dark:text-slate-200">
                    {CATEGORY_EMOJI[cat] || "📦"} {cat}
                  </span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-200">{formatCurrency(amt)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-5 rounded-full ${EXPENSE_COLORS[i % EXPENSE_COLORS.length]} transition-all`}
                    style={{ width: `${(amt / maxAmount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近の取引 */}
      {monthly.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow border border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200 mb-3">🗒️ 最近の取引</h3>
          <div className="flex flex-col gap-2">
            {monthly.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CATEGORY_EMOJI[t.category] || (t.type === "income" ? "💴" : t.type === "saving" ? "🏦" : "🛒")}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.category}</p>
                    <p className="text-xs text-slate-400">{t.date.slice(5).replace("-", "/")}日</p>
                  </div>
                </div>
                <span className={`text-lg font-extrabold ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : t.type === "saving" ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
                  {t.type === "expense" ? "－" : "＋"}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthly.length === 0 && (
        <div className="text-center py-12">
          <p className="text-5xl mb-4">📒</p>
          <p className="text-slate-500 dark:text-slate-400 text-base">まだ記録がありません。<br />今月の収支を入力してください。</p>
        </div>
      )}
    </div>
  )
}
