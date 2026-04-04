"use client"
// --- ダミー: テーマ購読用関数 ---
function subscribeThemeChange(callback: () => void) {
  if (typeof window !== "undefined") {
    window.addEventListener("kakeibo-theme-updated", callback)
    return () => window.removeEventListener("kakeibo-theme-updated", callback)
  }
  return () => {}
}
function readStoredTheme() {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("kakeibo-theme") || "dark"
  }
  return "dark"
}
function subscribeNoop() { return () => {}; }

// --- ダミー: エラーメッセージ整形 ---
function toFriendlyAuthErrorMessage(msg: string) { return msg; }
// 型定義のimport
import type { Profile, Transaction, Budget, NavPage } from "../lib/utils";
import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import { formatCurrency } from "../lib/utils";
import Dashboard from "../lib/components/Dashboard";
import InputForm from "../lib/components/InputForm";
import BottomNav from "../lib/components/BottomNav";
import Calendar from "../lib/components/Calendar";
import Charts from "../lib/components/Charts";
import AIAnalysis from "../lib/components/AIAnalysis";
import AnnualReport from "../lib/components/AnnualReport";
import GoalsAndDebt from "../lib/components/GoalsAndDebt";
import PresetSetup from "../lib/components/PresetSetup";
import AccountSettings from "../lib/components/AccountSettings";
import WelcomeView from "../lib/components/WelcomeView";
import AuthView from "../lib/components/AuthView";
import KidsDashboard from "../lib/components/KidsDashboard";
import SeniorDashboard from "../lib/components/SeniorDashboard";
import { useCharacterImage } from "../lib/hooks/useCharacterImage";

// ─── Main App ───────────────────────────────────────────────────────────────
export default function Home() {
  const { characterUrl } = useCharacterImage();
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [navPage, setNavPage] = useState<NavPage>("dashboard")
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [showAuthView, setShowAuthView] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [dashboardMode, setDashboardMode] = useState<'normal' | 'kids' | 'senior'>('normal')
  const [authNotice, setAuthNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [authPrefillEmail, setAuthPrefillEmail] = useState("")
  const theme = useSyncExternalStore(subscribeThemeChange, readStoredTheme, () => "dark")
  const hasHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)

  function toggleTheme() {
    if (typeof window === "undefined") return
    const nextTheme = theme === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", nextTheme)
    window.localStorage.setItem("kakeibo-theme", nextTheme)
    window.dispatchEvent(new Event("kakeibo-theme-updated"))
  }

  // AuthViewからmodeを受け取る
  const syncSessionToHome = useCallback(async (mode?: 'login' | 'register', email?: string, password?: string) => {
    const supabase = createClient();
    const useEmail = email || authPrefillEmail;
    const usePassword = password || "";
    if (!useEmail) {
      setAuthNotice({ type: "error", text: "メールアドレスを入力してください" });
      return;
    }
    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({ email: useEmail, password: usePassword });
      if (error || !data.user) {
        setAuthNotice({ type: "error", text: toFriendlyAuthErrorMessage(error?.message || "新規登録に失敗しました") });
        return;
      }
      setUser(data.user);
      setShowAuthView(false);
      setAuthNotice(null);
      setAuthPrefillEmail("");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: useEmail, password: usePassword });
      if (error || !data.user) {
        setAuthNotice({ type: "error", text: toFriendlyAuthErrorMessage(error?.message || "ログインに失敗しました") });
        return;
      }
      setUser(data.user);
      setShowAuthView(false);
      setAuthNotice(null);
      setAuthPrefillEmail("");
    }
  }, [authPrefillEmail]);

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
    let pendingAuthErrorMessage: string | null = null
    let pendingLineOauth = false
    let pendingLineEmail = ""
    let pendingLoginEmail = ""
    let pendingQrMagicSent = false
    let pendingQrMagicError: string | null = null

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const authError = params.get("auth_error")
      const oauthErrorDescription = params.get("error_description")
      const oauthError = params.get("error")
      const lineOauth = params.get("line_oauth")
      const lineEmail = params.get("line_email")
      const loginEmail = params.get("login_email")
      const qrMagicSent = params.get("qr_magic_sent")
      const qrError = params.get("qr_error")
      const displayError = authError || oauthErrorDescription || oauthError

      if (displayError) {
        pendingAuthErrorMessage = toFriendlyAuthErrorMessage(decodeURIComponent(displayError))
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
        window.history.replaceState({}, "", cleanUrl)
      }

      if (lineOauth === "ok") {
        pendingLineOauth = true
        pendingLineEmail = lineEmail ? decodeURIComponent(lineEmail) : ""
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
        window.history.replaceState({}, "", cleanUrl)
      }

      if (loginEmail) {
        pendingLoginEmail = decodeURIComponent(loginEmail)
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
        window.history.replaceState({}, "", cleanUrl)
      }

      if (qrMagicSent === "1") {
        pendingQrMagicSent = true
      }

      if (qrError) {
        pendingQrMagicError = decodeURIComponent(qrError)
      }

      if (qrMagicSent === "1" || qrError) {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
        window.history.replaceState({}, "", cleanUrl)
      }
    }

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        setShowAuthView(true)
        setAuthNotice({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      }

      if (!session?.user && pendingAuthErrorMessage) {
        setShowAuthView(true)
        setAuthNotice({ type: "error", text: pendingAuthErrorMessage })
      }

      if (!session?.user && pendingLineOauth) {
        if (pendingLineEmail) {
          // LINEで取得したメールにOTPを自動送信してマジックリンクログイン
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: pendingLineEmail,
            options: { shouldCreateUser: true },
          })
          setShowAuthView(true)
          if (otpError) {
            setAuthNotice({ type: "error", text: `メール送信に失敗しました: ${otpError.message}` })
          } else {
            setAuthNotice({ type: "success", text: `✅ ${pendingLineEmail} にログインリンクを送信しました。メールを開いてリンクをタップしてください。` })
          }
        } else {
          setShowAuthView(true)
          setAuthNotice({ type: "error", text: "LINE認証は完了しましたが、メールアドレスを取得できませんでした。" })
        }
      }

      if (!session?.user && pendingLoginEmail) {
        setAuthPrefillEmail(pendingLoginEmail)
        setShowAuthView(true)
      }

      if (!session?.user && pendingQrMagicSent) {
        setShowAuthView(true)
        setAuthNotice({ type: "success", text: "ログイン用メールリンクを送信しました。スマホのメールを開いてリンクをタップしてください。" })
      }

      if (!session?.user && pendingQrMagicError) {
        setShowAuthView(true)
        setAuthNotice({ type: "error", text: toFriendlyAuthErrorMessage(pendingQrMagicError) })
      }

      setUser(session?.user ?? null)
      if (session?.user) {
        setShowAuthView(false)
        setAuthNotice(null)
      }
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setShowAuthView(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

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
    const hasPresetTargets = Boolean(
      profileData &&
      profileData.allocation_target_fixed_rate != null &&
      profileData.allocation_target_variable_rate != null &&
      profileData.allocation_target_savings_rate != null
    )
    setNeedsSetup(!profileData || !hasPresetTargets)
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

  async function handleGuestLogin() {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) {
      setAuthNotice({ type: "error", text: "ゲストログインに失敗しました。しばらくしてから再試行してください。" })
      return
    }
    setUser(data.user)
    setShowAuthView(false)
    setAuthNotice(null)
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

  async function handleShare() {
    const [year, month] = currentMonth.split("-").map(Number)
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`
    const monthly = transactions.filter(t => t.date.startsWith(monthPrefix))
    const income = monthly.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
    const expense = monthly.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
    const balance = income - expense

    const shareText = `家計簿 ${year}年${month}月\n収入: ${formatCurrency(income)}\n支出: ${formatCurrency(expense)}\n収支: ${formatCurrency(balance)}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: "家計簿サマリー",
          text: shareText,
          url: window.location.href,
        })
        return
      }

      await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`)
      alert("共有テキストをクリップボードにコピーしました")
    } catch {
      alert("共有に失敗しました")
    }
  }

  async function handleShareTransaction(tx: Transaction) {
    const signedAmount = `${tx.type === "expense" ? "-" : "+"}${formatCurrency(tx.amount)}`
    const txText = [
      "家計簿 取引メモ",
      `日付: ${tx.date}`,
      `種別: ${tx.type}`,
      `カテゴリ: ${tx.category}`,
      `金額: ${signedAmount}`,
      `支払方法: ${tx.payment_method}`,
      `メモ: ${tx.memo || "-"}`,
    ].join("\n")

    try {
      if (navigator.share) {
        await navigator.share({
          title: "家計簿 取引",
          text: txText,
        })
        return
      }

      await navigator.clipboard.writeText(txText)
      alert("取引内容をクリップボードにコピーしました")
    } catch {
      alert("共有に失敗しました")
    }
  }

  async function handleDeleteTransaction(tx: Transaction) {
    const ok = window.confirm(`この取引を削除しますか？\n${tx.date} ${tx.category} ${formatCurrency(tx.amount)}`)
    if (!ok) return
    if (!user?.id) {
      alert("ユーザー情報を確認できません。再ログインしてください。")
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", tx.id)
      .eq("user_id", user.id)

    if (error) {
      alert("削除に失敗しました: " + error.message)
      return
    }

    setTransactions((prev) => prev.filter((item) => item.id !== tx.id))
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
      <>
        <button
          type="button"
          onClick={toggleTheme}
          className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          {hasHydrated ? (theme === "dark" ? "ライト" : "ダーク") : "テーマ"}
        </button>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <p className="text-slate-400 animate-pulse">読み込み中...</p>
        </div>
      </>
    )
  }

  if (!user) {
    if (!showAuthView) {
      return (
        <>
          <button
            type="button"
            onClick={toggleTheme}
            className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
          >
            {hasHydrated ? (theme === "dark" ? "ライト" : "ダーク") : "テーマ"}
          </button>
          <WelcomeView onStartAuth={() => setShowAuthView(true)} />
        </>
      )
    }
    return (
      <>
        <button
          type="button"
          onClick={toggleTheme}
          className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          {theme === "dark" ? "ライト" : "ダーク"}
        </button>
        <AuthView onAuth={syncSessionToHome} onBack={() => setShowAuthView(false)} initialMessage={authNotice} initialEmail={authPrefillEmail} onGuestLogin={handleGuestLogin} />
      </>
    )
  }

  if (needsSetup) {
    return (
      <>
        <button
          type="button"
          onClick={toggleTheme}
          className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          {theme === "dark" ? "ライト" : "ダーク"}
        </button>
        <PresetSetup mode="create" onComplete={(nextProfile) => {
          setProfile(nextProfile)
          setNeedsSetup(false)
          setShowAuthView(false)
          loadData()
        }} />
      </>
    )
  }

  if (showProfileSettings) {
    return (
      <>
        <button
          type="button"
          onClick={toggleTheme}
          className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          {theme === "dark" ? "ライト" : "ダーク"}
        </button>
        <PresetSetup
          mode="edit"
          initialProfile={profile}
          onCancel={() => setShowProfileSettings(false)}
          onComplete={(nextProfile) => {
            setProfile(nextProfile)
            setShowProfileSettings(false)
            loadData()
          }}
        />
      </>
    )
  }

  if (showAccountSettings) {
    return (
      <>
        <button
          type="button"
          onClick={toggleTheme}
          className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          {theme === "dark" ? "ライト" : "ダーク"}
        </button>
        <AccountSettings
          user={user}
          profile={profile}
          onClose={() => setShowAccountSettings(false)}
          onProfileUpdated={(nextProfile) => {
            setProfile(nextProfile)
            loadData()
          }}
        />
      </>
    )
  }

  const [year, month] = currentMonth.split("-").map(Number)
  const monthLabel = `${year}年${month}月`
  const now = new Date()
  const isCurrentMonth = currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const NAV_ITEMS = [
    { page: "dashboard" as const, icon: "📊", label: "ダッシュボード" },
    { page: "calendar" as const, icon: "📅", label: "カレンダー" },
    { page: "charts" as const, icon: "📈", label: "グラフ" },
    { page: "ai" as const, icon: "🤖", label: "AI分析" },
    { page: "report" as const, icon: "📄", label: "レポート" },
    { page: "goals" as const, icon: "🎯", label: "目標・ローン" },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-950">
      {/* キャラクター（ログイン後も表示） */}
      {characterUrl && (
        <div className="fixed left-3 bottom-3 z-40 pointer-events-none select-none">
          <div className="animate-float-slow">
            <img src={characterUrl} alt="キャラクター" className="w-14 h-14 rounded-full object-cover border-4 border-pink-200 shadow-lg" />
          </div>
        </div>
      )}

      {/* ゲストバナー */}
      {user?.is_anonymous && (
        <div className="shrink-0 bg-amber-950 border-b border-amber-700/60 px-4 py-1.5 flex items-center justify-between gap-3 no-print">
          <p className="text-xs text-amber-200">👤 ゲストモード — ログアウトするとデータは消えます</p>
          <button
            type="button"
            onClick={() => setShowAuthView(true)}
            className="shrink-0 text-xs px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
          >
            アカウント登録
          </button>
        </div>
      )}

      {/* トップバー */}
      <header className="shrink-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 no-print">
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          {/* アプリ名 */}
          <span className="text-base font-extrabold text-emerald-400 whitespace-nowrap shrink-0">きらきら家計簿</span>

          {/* 月切替 */}
          {(navPage === "dashboard" || navPage === "charts" || navPage === "calendar") && (
            <div className="month-switch-group flex items-center gap-1">
              <button onClick={prevMonth} className="month-switch-arrow p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">◀</button>
              <button onClick={goToday} className={`month-switch-current text-xs px-2 py-1 rounded-lg transition-all ${isCurrentMonth ? "text-white bg-violet-600/30" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}>
                {monthLabel}
              </button>
              <button onClick={nextMonth} className="month-switch-arrow p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">▶</button>
            </div>
          )}

          {/* ダッシュボードモード切替 */}
          {navPage === "dashboard" && (
            <div className="flex items-center gap-0.5 bg-slate-800 rounded-xl p-0.5">
              <button onClick={() => setDashboardMode('normal')} className={`text-xs px-2 py-1 rounded-lg font-bold transition-all ${dashboardMode === 'normal' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>通常</button>
              <button onClick={() => setDashboardMode('kids')} className={`text-xs px-2 py-1 rounded-lg font-bold transition-all ${dashboardMode === 'kids' ? 'bg-pink-500 text-white' : 'text-slate-400 hover:text-white'}`}>こども</button>
              <button onClick={() => setDashboardMode('senior')} className={`text-xs px-2 py-1 rounded-lg font-bold transition-all ${dashboardMode === 'senior' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>シニア</button>
            </div>
          )}

          {/* アクション */}
          <div className="flex items-center gap-1 ml-auto">
            {navPage === "dashboard" && (
              <>
                <button onClick={generateFixedCosts} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="固定費を来月分コピー">🔁</button>
                <button onClick={handleShare} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="共有">📤</button>
                <button onClick={exportCSV} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="CSV出力">📥</button>
              </>
            )}
            <button onClick={() => window.print()} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="印刷">🖨️</button>
            <button onClick={toggleTheme} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <a href="/settings" className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">🎨</a>
            <button onClick={() => setShowAccountSettings(true)} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">設定</button>
            <button onClick={() => setShowProfileSettings(true)} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">目標</button>
            <button onClick={handleSignOut} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-red-600/30 transition-colors">ログアウト</button>
          </div>
        </div>
      </header>

      {/* 3カラムボディ */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* 左カラム (2) — サイドナビ（lg以上のみ表示） */}
        <aside className="hidden lg:flex flex-2 min-w-0 flex-col bg-slate-900 border-r border-slate-800 overflow-y-auto no-print">
          <nav className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map(({ page, icon, label }) => (

              <button
                type="button"
                key={page}
                onClick={() => setNavPage(page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  navPage === page
                    ? "bg-violet-600/20 text-violet-300 border border-violet-700/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto p-3 border-t border-slate-800">
            <p className="text-xs text-slate-500 truncate">{profile?.display_name ?? ""}</p>
          </div>
        </aside>

        {/* 中央カラム (5) — メインコンテンツ */}
        <main className="flex-1 lg:flex-5 min-w-0 overflow-y-auto pb-14 lg:pb-0">
          <div className="p-3 md:p-4 min-h-full">
            {dataLoading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-400 animate-pulse">データ読み込み中...</p>
              </div>
            ) : (
              <>
                {navPage === "dashboard" && dashboardMode === 'normal' && (
                  <Dashboard
                    transactions={transactions}
                    budgets={budgets}
                    currentMonth={currentMonth}
                    profile={profile}
                    onOpenSetup={() => setShowProfileSettings(true)}
                  />
                )}
                {navPage === "dashboard" && dashboardMode === 'kids' && (
                  <KidsDashboard transactions={transactions} currentMonth={currentMonth} />
                )}
                {navPage === "dashboard" && dashboardMode === 'senior' && (
                  <SeniorDashboard transactions={transactions} currentMonth={currentMonth} />
                )}
                {/* モバイル入力ページ（lgでは右カラムに表示） */}
                {navPage === "input" && (
                  <div className="lg:hidden flex flex-col gap-3">
                    <InputForm
                      recentTransactions={transactions}
                      onSuccess={tx => {
                        setTransactions(prev => [tx, ...prev])
                        setCurrentMonth(tx.date.slice(0, 7))
                        setNavPage("dashboard")
                      }}
                    />
                    <div className="border-t border-slate-800 pt-3">
                      <h3 className="text-xs font-semibold text-slate-400 mb-2">📝 直近の取引</h3>
                      <div className="space-y-1.5">
                        {transactions.slice(0, 20).map(t => (
                          <div key={t.id} className="flex items-center justify-between text-xs bg-slate-800/40 rounded-lg px-2 py-1.5">
                            <div className="min-w-0 flex-1">
                              <span className="text-slate-500">{t.date.slice(5)} </span>
                              <span className="text-slate-200">{t.category}</span>
                              {t.memo && <span className="text-slate-500"> · {t.memo}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className={
                                t.type === "income" ? "text-emerald-400 font-semibold"
                                : t.type === "saving" ? "text-blue-400 font-semibold"
                                : t.type === "investment" ? "text-violet-400 font-semibold"
                                : "text-red-400 font-semibold"
                              }>
                                {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteTransaction(t)}
                                className="px-1 py-0.5 rounded border border-red-800/50 text-red-400 hover:text-red-200 text-[10px]"
                              >削除</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* lgでは input は dashboard と同じ扱い */}
                {navPage === "input" && (
                  <div className="hidden lg:block">
                    {dashboardMode === 'kids' ? (
                      <KidsDashboard transactions={transactions} currentMonth={currentMonth} />
                    ) : dashboardMode === 'senior' ? (
                      <SeniorDashboard transactions={transactions} currentMonth={currentMonth} />
                    ) : (
                      <Dashboard
                        transactions={transactions}
                        budgets={budgets}
                        currentMonth={currentMonth}
                        profile={profile}
                        onOpenSetup={() => setShowProfileSettings(true)}
                      />
                    )}
                  </div>
                )}
                {navPage === "calendar" && (
                  <Calendar transactions={transactions} currentMonth={currentMonth} />
                )}
                {navPage === "charts" && (
                  <Charts transactions={transactions} currentMonth={currentMonth} />
                )}
                {navPage === "ai" && (
                  <AIAnalysis
                    transactions={transactions}
                    currentMonth={currentMonth}
                  />
                )}
                {navPage === "report" && (
                  <AnnualReport transactions={transactions} currentMonth={currentMonth} />
                )}
                {navPage === "goals" && (
                  <GoalsAndDebt transactions={transactions} currentMonth={currentMonth} />
                )}
              </>
            )}
          </div>
        </main>

        {/* 右カラム (3) — 入力フォーム＋履歴（lg以上のみ表示） */}
        <aside className="hidden lg:flex lg:flex-3 min-w-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900/40">
          <div className="p-3">
            <InputForm
              recentTransactions={transactions}
              onSuccess={tx => {
                setTransactions(prev => [tx, ...prev])
                setCurrentMonth(tx.date.slice(0, 7))
              }}
            />
          </div>
          <div className="border-t border-slate-800 p-3">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">📝 直近の取引</h3>
            <div className="space-y-1.5">
              {transactions.slice(0, 30).map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs bg-slate-800/40 rounded-lg px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500">{t.date.slice(5)} </span>
                    <span className="text-slate-200">{t.category}</span>
                    {t.memo && <span className="text-slate-500"> · {t.memo}</span>}
                    {t.is_fixed && <span className="ml-1 text-violet-300">固定</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={
                      t.type === "income" ? "text-emerald-400 font-semibold"
                      : t.type === "saving" ? "text-blue-400 font-semibold"
                      : t.type === "investment" ? "text-violet-400 font-semibold"
                      : "text-red-400 font-semibold"
                    }>
                      {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleShareTransaction(t)}
                      className="px-1 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-[10px]"
                    >共有</button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTransaction(t)}
                      className="px-1 py-0.5 rounded border border-red-800/50 text-red-400 hover:text-red-200 hover:border-red-500 text-[10px]"
                    >削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </div>{/* /3カラム */}

      {/* モバイル用ボトムナビ（lg未満のみ表示） */}
      <div className="lg:hidden no-print">
        <BottomNav current={navPage} onChange={setNavPage} />
      </div>
    </div>
  )
}
