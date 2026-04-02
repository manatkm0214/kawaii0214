"use client"

import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { signUpWithAutoConfirm, signInWithPassword } from "@/lib/supabase/actions"
import { Transaction, Budget, Profile, NavPage, formatCurrency } from "@/lib/utils"
import BottomNav from "@/lib/components/BottomNav"
import Dashboard from "@/lib/components/Dashboard"
import InputForm from "@/lib/components/InputForm"
import Charts from "@/lib/components/Charts"
import AIAnalysis from "@/lib/components/AIAnalysis"
import AnnualReport from "@/lib/components/AnnualReport"
import PresetSetup from "@/lib/components/PresetSetup"

// ─── Auth View ──────────────────────────────────────────────────────────────
function AuthView({ onAuth }: { onAuth: () => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  // パスワードバリデーション
  function validatePassword(pwd: string) {
    const hasLetters = /[a-zA-Z]/.test(pwd)
    const hasNumbers = /[0-9]/.test(pwd)
    const isLongEnough = pwd.length >= 8
    return { hasLetters, hasNumbers, isLongEnough }
  }

  function isPasswordValid(pwd: string): boolean {
    const { hasLetters, hasNumbers, isLongEnough } = validatePassword(pwd)
    return hasLetters && hasNumbers && isLongEnough
  }

  async function handleSubmit() {
    if (!email || !password) { alert("メールアドレスとパスワードを入力してください"); return }
    if (!isLogin && !isPasswordValid(password)) { 
      alert("パスワードは以下を満たす必要があります：\n・8文字以上\n・英字を含む (A-Z, a-z)\n・数字を含む (0-9)"); 
      return 
    }
    setLoading(true)
    
    if (isLogin) {
      const { error } = await signInWithPassword(email, password)
      setLoading(false)
      if (error) {
        const message = error.includes("Invalid login credentials") 
          ? "メールアドレスまたはパスワードが間違っています"
          : error
        alert("ログイン失敗: " + message); 
        return 
      }
      onAuth()
    } else {
      const { error } = await signUpWithAutoConfirm(email, password)
      setLoading(false)
      if (error) {
        let message = error || "不明なエラーが発生しました"
        if (message.includes("Invalid API key") || message.includes("invalid_api_key")) message = "Supabaseの設定に問題があります。管理者にお問い合わせください。"
        if (message.includes("already registered") || message.includes("already exists")) message = "このメールアドレスは既に登録されています"
        if (message.includes("Password should")) message = "パスワードは8文字以上で、英字と数字を含む必要があります"
        if (message.includes("invalid email")) message = "有効なメールアドレスを入力してください"
        if (message.includes("validation failed")) message = "入力内容を確認してください。特にパスワードは英字と数字を含む8文字以上が必要です"
        alert("登録失敗: " + message)
        return
      }
      alert("登録完了！ログインしてください")
      setIsLogin(true)
      setEmail("")
      setPassword("")
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 animate-slide-up">
        <div className="text-center">
          <p className="text-5xl mb-3">💰</p>
          <h1 className="text-2xl font-bold text-white">家計簿アプリ</h1>
          <p className="text-slate-300 text-sm mt-1">AIと一緒に賢く管理</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <div className="flex bg-slate-900 rounded-xl p-1">
            {(["ログイン", "新規登録"] as const).map((label, i) => (
              <button
                key={label}
                onClick={() => setIsLogin(i === 0)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  (i === 0) === isLogin ? "bg-violet-600 text-white" : "text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
          />
          <div>
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            />
            {!isLogin && password && (
              <div className="text-xs text-slate-400 mt-2 space-y-1">
                {(() => {
                  const { hasLetters, hasNumbers, isLongEnough } = validatePassword(password)
                  const allValid = hasLetters && hasNumbers && isLongEnough
                  return (
                    <>
                      <p className={allValid ? "text-emerald-400" : ""}>
                        <span>{isLongEnough ? "✓" : "✕"} 8文字以上 ({password.length}文字)</span>
                      </p>
                      <p className={hasLetters ? "text-emerald-400" : ""}>
                        <span>{hasLetters ? "✓" : "✕"} 英字を含む (A-Z, a-z)</span>
                      </p>
                      <p className={hasNumbers ? "text-emerald-400" : ""}>
                        <span>{hasNumbers ? "✓" : "✕"} 数字を含む (0-9)</span>
                      </p>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || (!isLogin && !isPasswordValid(password))}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all"
          >
            {loading ? "処理中..." : isLogin ? "ログイン" : "登録する"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [navPage, setNavPage] = useState<NavPage>("dashboard")
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  // 月切替
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  function prevMonth() {
    const [y, m] = currentMonth.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  function nextMonth() {
    const [y, m] = currentMonth.split("-").map(Number)
    const d = new Date(y, m, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  function goToday() {
    const now = new Date()
    setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  }

  // 認証チェック
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // データ取得
  const loadData = useCallback(async () => {
    if (!user) return
    setDataLoading(true)
    const supabase = createClient()

    const [{ data: profileData }, { data: txData }, { data: budgetData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("budgets").select("*").eq("user_id", user.id),
    ])

    setProfile(profileData)
    setTransactions(txData ?? [])
    setBudgets(budgetData ?? [])
    setNeedsSetup(!profileData)
    setDataLoading(false)
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [loadData])

  async function handleSignOut() {
    await createClient().auth.signOut()
    setUser(null)
    setProfile(null)
    setTransactions([])
  }

  async function exportCSV() {
    const header = "日付,種別,カテゴリ,金額,支払方法,メモ,固定費\n"
    const rows = transactions.map(t =>
      `${t.date},${t.type},${t.category},${t.amount},${t.payment_method},${t.memo},${t.is_fixed ? "○" : ""}`
    ).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `家計簿_${currentMonth}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function generateFixedCosts() {
    const res = await fetch("/api/fixed-costs", { method: "POST" })
    const data = await res.json()
    alert(data.message)
    loadData()
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">読み込み中...</p>
      </div>
    )
  }

  if (!user) {
    return <AuthView onAuth={() => { /* useEffect が自動検知 */ }} />
  }

  if (needsSetup) {
    return <PresetSetup onComplete={() => { setNeedsSetup(false); loadData() }} />
  }

  const [year, month] = currentMonth.split("-").map(Number)
  const monthLabel = `${year}年${month}月`
  const now = new Date()
  const isCurrentMonth = currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-slate-800 no-print">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-white">
              {navPage === "dashboard" ? "📊 ダッシュボード"
                : navPage === "input" ? "✏️ 入力"
                : navPage === "charts" ? "📈 グラフ"
                : navPage === "ai" ? "🤖 AI分析"
                : "📄 レポート"}
            </h1>
            <p className="text-xs text-slate-400">{profile?.display_name ?? ""}</p>
          </div>

          {/* 月切替（dashboardとchartsで表示） */}
          {(navPage === "dashboard" || navPage === "charts") && (
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">◀</button>
              <button onClick={goToday} className={`text-xs px-2 py-1 rounded-lg transition-all ${isCurrentMonth ? "text-white bg-violet-600/30" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}>
                {monthLabel}
              </button>
              <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">▶</button>
            </div>
          )}

          {/* メニュー */}
          <div className="flex gap-1">
            {navPage === "dashboard" && (
              <>
                <button onClick={generateFixedCosts} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="固定費を来月分コピー">🔁</button>
                <button onClick={exportCSV} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="CSV出力">📥</button>
              </>
            )}
            <button onClick={handleSignOut} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-red-600/30 transition-colors">ログアウト</button>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-slate-400 animate-pulse">データ読み込み中...</p>
          </div>
        ) : (
          <>
            {navPage === "dashboard" && (
              <Dashboard transactions={transactions} budgets={budgets} currentMonth={currentMonth} />
            )}
            {navPage === "input" && (
              <div className="space-y-4">
                <InputForm
                  recentTransactions={transactions}
                  onSuccess={tx => {
                    setTransactions(prev => [tx, ...prev])
                    setNavPage("dashboard")
                  }}
                />
                {/* 直近取引履歴 */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">📝 直近の取引</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {transactions.slice(0, 20).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400">{t.date.slice(5)} </span>
                          <span className="text-white">{t.category}</span>
                          {t.memo && <span className="text-slate-400"> · {t.memo}</span>}
                          {t.is_fixed && <span className="ml-1 text-violet-300 font-semibold">固定</span>}
                        </div>
                        <span className={
                          t.type === "income" ? "text-emerald-400 font-semibold"
                          : t.type === "saving" ? "text-blue-400 font-semibold"
                          : t.type === "investment" ? "text-violet-400 font-semibold"
                          : "text-red-400 font-semibold"
                        }>
                          {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {navPage === "charts" && (
              <Charts transactions={transactions} currentMonth={currentMonth} />
            )}
            {navPage === "ai" && (
              <AIAnalysis transactions={transactions} currentMonth={currentMonth} />
            )}
            {navPage === "report" && (
              <AnnualReport transactions={transactions} currentMonth={currentMonth} />
            )}
          </>
        )}
      </main>

      {/* ボトムナビ */}
      <BottomNav current={navPage} onChange={setNavPage} />
    </div>
  )
}
