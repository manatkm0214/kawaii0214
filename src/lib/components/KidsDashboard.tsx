"use client"
import { Transaction } from "../utils"
import { formatCurrency } from "../utils"

interface Props {
  transactions: Transaction[]
  currentMonth: string
}

const KIDS_EXPENSE_CATEGORIES = ["おやつ", "おもちゃ", "ゲーム", "本・まんが", "文房具", "交通", "食費", "日用品", "その他"]
const KIDS_INCOME_CATEGORIES = ["おこづかい", "お年玉", "誕生日プレゼント", "臨時収入", "給料", "副業", "その他"]

const EMOJI_MAP: Record<string, string> = {
  "おやつ": "🍩", "おもちゃ": "🧸", "ゲーム": "🎮", "本・まんが": "📚",
  "文房具": "✏️", "交通": "🚃", "食費": "🍱", "日用品": "🛒",
  "おこづかい": "💰", "お年玉": "🎍", "誕生日プレゼント": "🎂",
  "臨時収入": "⭐", "その他": "📦",
}

const COLOR_MAP = [
  "bg-pink-400", "bg-violet-400", "bg-blue-400", "bg-emerald-400",
  "bg-yellow-400", "bg-orange-400", "bg-cyan-400", "bg-rose-400",
]

export default function KidsDashboard({ transactions, currentMonth }: Props) {
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
    <div className="flex flex-col gap-4 p-2">
      {/* タイトル */}
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-pink-500 drop-shadow">
          🌟 {year}年{month}月 おこづかい帳 🌟
        </h2>
      </div>

      {/* メインカード3つ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-100 rounded-3xl p-4 flex flex-col items-center shadow border-2 border-emerald-300">
          <span className="text-3xl mb-1">💰</span>
          <p className="text-xs font-bold text-emerald-600 mb-1">もらったお金</p>
          <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(income)}</p>
        </div>
        <div className="bg-red-100 rounded-3xl p-4 flex flex-col items-center shadow border-2 border-red-300">
          <span className="text-3xl mb-1">🛍️</span>
          <p className="text-xs font-bold text-red-500 mb-1">つかったお金</p>
          <p className="text-lg font-extrabold text-red-600">{formatCurrency(expense)}</p>
        </div>
        <div className="bg-blue-100 rounded-3xl p-4 flex flex-col items-center shadow border-2 border-blue-300">
          <span className="text-3xl mb-1">🐷</span>
          <p className="text-xs font-bold text-blue-600 mb-1">ためたお金</p>
          <p className="text-lg font-extrabold text-blue-700">{formatCurrency(saving)}</p>
        </div>
      </div>

      {/* 残高 */}
      <div className={`rounded-3xl p-5 text-center shadow-lg border-4 ${balance >= 0 ? "bg-yellow-50 border-yellow-300" : "bg-red-50 border-red-300"}`}>
        <p className="text-sm font-bold text-slate-500 mb-1">💫 のこりのお金</p>
        <p className={`text-4xl font-extrabold ${balance >= 0 ? "text-yellow-500" : "text-red-500"}`}>
          {formatCurrency(balance)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {balance >= 0 ? "えらい！ちゃんとのこってるよ🎉" : "つかいすぎかも…気をつけよう💦"}
        </p>
      </div>

      {/* カテゴリ別支出 */}
      {sortedCategories.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-800/80 rounded-3xl p-4 shadow border border-pink-100 dark:border-slate-700">
          <h3 className="text-sm font-extrabold text-pink-500 mb-3">🏷️ なにに つかったかな？</h3>
          <div className="flex flex-col gap-3">
            {sortedCategories.map(([cat, amt], i) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {EMOJI_MAP[cat] || "📦"} {cat}
                  </span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{formatCurrency(amt)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full ${COLOR_MAP[i % COLOR_MAP.length]} transition-all`}
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
        <div className="bg-white/80 dark:bg-slate-800/80 rounded-3xl p-4 shadow border border-pink-100 dark:border-slate-700">
          <h3 className="text-sm font-extrabold text-pink-500 mb-3">📝 さいきんのきろく</h3>
          <div className="flex flex-col gap-2">
            {monthly.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-2xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{EMOJI_MAP[t.category] || (t.type === "income" ? "💰" : t.type === "saving" ? "🐷" : "🛍️")}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.category}</p>
                    <p className="text-[10px] text-slate-400">{t.date.slice(5).replace("-", "/")}日</p>
                  </div>
                </div>
                <span className={`text-sm font-extrabold ${t.type === "income" ? "text-emerald-500" : t.type === "saving" ? "text-blue-500" : "text-red-500"}`}>
                  {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthly.length === 0 && (
        <div className="text-center py-10">
          <p className="text-4xl mb-3">📒</p>
          <p className="text-slate-400 font-bold">まだきろくがないよ！<br />さいしょのきろくをつけてみよう🌟</p>
        </div>
      )}
    </div>
  )
}
