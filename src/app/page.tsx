"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Transaction, Budget, Profile, NavPage, formatCurrency } from "@/lib/utils"
import BottomNav from "@/lib/components/BottomNav"
import Dashboard from "@/lib/components/Dashboard"
import InputForm from "@/lib/components/InputForm"
import Charts from "@/lib/components/Charts"
import AIAnalysis from "@/lib/components/AIAnalysis"
import AnnualReport from "@/lib/components/AnnualReport"
import PresetSetup from "@/lib/components/PresetSetup"

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

function toFriendlyAuthErrorMessage(raw: string): string {
  const message = raw.toLowerCase()

  if (message.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが間違っています"
  }
  if (message.includes("email not confirmed")) {
    return "メール認証が完了していません。受信メールをご確認ください"
  }
  if (message.includes("too many requests") || message.includes("over_email_send_rate_limit")) {
    return "試行回数が多すぎます。少し待ってから再試行してください"
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "通信エラーです。ネットワーク接続を確認してください"
  }
  if (message.includes("invalid api key") || message.includes("invalid_api_key")) {
    return "認証設定に問題があります。管理者にお問い合わせください"
  }
  if (message.includes("jwt") || message.includes("token")) {
    return "セッションエラーが発生しました。ページを再読み込みして再試行してください"
  }
  if (message.includes("provider") && message.includes("disabled")) {
    return "このログイン方式は現在無効です。管理者に有効化を依頼してください"
  }
  if (message.includes("redirect_to is not allowed") || message.includes("redirect url") || message.includes("redirect_uri_mismatch")) {
    return "認証リダイレクトURL設定が一致していません。管理者に設定確認を依頼してください"
  }

  return raw
}

function getAuthCallbackUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}/auth/callback`
  }
  return "/auth/callback"
}

function getPasswordResetUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/reset-password`
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}/auth/reset-password`
  }

  return "/auth/reset-password"
}

function buildLoginPasswordCandidates(rawPassword: string): string[] {
  const candidates = [
    rawPassword,
    rawPassword.normalize("NFKC"),
    rawPassword.trim(),
    rawPassword.normalize("NFKC").trim(),
  ]

  return [...new Set(candidates)]
}

// ─── Auth View ──────────────────────────────────────────────────────────────
function WelcomeView({ onStartAuth }: { onStartAuth: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 animate-slide-up">
        <div className="text-center">
          <div className="mx-auto mb-3 w-20 h-20 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/70">
            <Image
              src="/logo-kakeibo.svg"
              alt="家計簿アプリ ロゴ"
              width={80}
              height={80}
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-white">家計簿アプリ</h1>
          <p className="text-slate-300 text-sm mt-1">AIと一緒に賢く管理</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <p className="text-sm text-slate-200 leading-relaxed">
            支出の記録、予算管理、将来予測までを1つにまとめた家計管理アプリです。
          </p>
          <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
            <li>日々の収支をかんたん入力</li>
            <li>グラフとレポートで家計を見える化</li>
            <li>AI分析で改善アクションを提案</li>
          </ul>
          <button
            type="button"
            onClick={onStartAuth}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition-all text-white"
          >
            ログイン / 新規登録へ進む
          </button>
          <div className="text-center text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 underline underline-offset-2">プライバシーポリシー</Link>
            {' '}
            <span>·</span>
            {' '}
            <Link href="/terms" className="hover:text-slate-300 underline underline-offset-2">利用規約</Link>
            {' '}
            <span>·</span>
            {' '}
            <Link href="/contact" className="hover:text-slate-300 underline underline-offset-2">お問い合わせ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthView({ onAuth, onBack }: { onAuth: (nextUser?: User | null) => Promise<void> | void; onBack?: () => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [signupMessage, setSignupMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handlePasswordLogin() {
    await handleSubmit()
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setSignupMessage({ type: "error", text: "メールアドレスを入力してからパスワード再設定リンクを押してください" })
      return
    }

    setLoading(true)
    const callbackUrl = getPasswordResetUrl()
    const { error } = await createClient().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: callbackUrl,
    })
    setLoading(false)

    if (error) {
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    setSignupMessage({ type: "success", text: `${normalizedEmail} にパスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。` })
  }

  async function handleResendConfirmationEmail() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setSignupMessage({ type: "error", text: "メールアドレスを入力してから確認メール再送を押してください" })
      return
    }

    setLoading(true)
    const callbackUrl = getAuthCallbackUrl()
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: callbackUrl,
      },
    })
    setLoading(false)

    if (error) {
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    setSignupMessage({ type: "success", text: `${normalizedEmail} に確認メールを再送しました。受信メールのリンクをクリックして認証を完了してください。` })
  }

  async function handleMagicLinkLogin() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setSignupMessage({ type: "error", text: "メールアドレスを入力してからメールリンクログインを押してください" })
      return
    }

    setLoading(true)
    const callbackUrl = getAuthCallbackUrl()
    const { error } = await createClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: callbackUrl,
        shouldCreateUser: false,
      },
    })
    setLoading(false)

    if (error) {
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    setSignupMessage({ type: "success", text: `${normalizedEmail} にログイン用リンクを送信しました。受信メールをご確認ください。` })
  }

  async function handleLineLogin() {
    setSignupMessage(null)
    setLoading(true)
    const callbackUrl = getAuthCallbackUrl()
    const { data, error } = await createClient().auth.signInWithOAuth({
      provider: "line" as "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      setLoading(false)
      return
    }

    if (!data?.url) {
      setSignupMessage({ type: "error", text: "LINEログインを開始できませんでした。メールリンクログインもお試しください" })
      setLoading(false)
      return
    }

    window.location.assign(data.url)
  }

  async function handleDemoLogin() {
    const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim()
    const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD?.trim()

    if (!demoEmail || !demoPassword) {
      setSignupMessage({ type: "error", text: "デモログインが設定されていません" })
      return
    }

    setLoading(true)
    const { data, error } = await createClient().auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    })
    setLoading(false)

    if (error) {
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    await onAuth(data.session?.user ?? data.user ?? null)
  }

  async function handleSubmit() {
    const normalizedEmail = email.trim().toLowerCase()
    const supabase = createClient()

    setSignupMessage(null)

    if (!normalizedEmail || !password) { setSignupMessage({ type: "error", text: "メールアドレスとパスワードを入力してください" }); return }
    if (!isLogin && !isPasswordValid(password)) {
      setSignupMessage({ type: "error", text: "パスワードは8文字以上・英字・数字を含む必要があります" })
      return
    }
    setLoading(true)
    
    if (isLogin) {
      let loginError: string | null = null
      let signedInUser: User | null = null
      const passwordCandidates = buildLoginPasswordCandidates(password)

      for (const candidate of passwordCandidates) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: candidate,
        })

        if (!error) {
          loginError = null
          signedInUser = data.session?.user ?? data.user ?? null
          break
        }

        loginError = error.message
        if (!error.message.toLowerCase().includes("invalid login credentials")) {
          break
        }
      }

      setLoading(false)
      if (loginError) {
        const friendly = toFriendlyAuthErrorMessage(loginError)
        if (friendly.includes("メールアドレスまたはパスワードが間違っています")) {
          setSignupMessage({ type: "error", text: friendly + "　→ 下の「メールリンクログイン」も使えます" })
        } else if (friendly.includes("メール認証が完了していません")) {
          setSignupMessage({ type: "error", text: friendly + "　→ 下の「確認メール再送」で再送できます" })
        } else {
          setSignupMessage({ type: "error", text: friendly })
        }
        return 
      }
      await onAuth(signedInUser)
    } else {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      })
      setLoading(false)
      if (error) {
        let message = error.message || "不明なエラーが発生しました"
        if (message.includes("Invalid API key") || message.includes("invalid_api_key")) message = "Supabaseの設定に問題があります。管理者にお問い合わせください。"
        if (message.includes("already registered") || message.includes("already exists")) message = "このメールアドレスは既に登録されています"
        if (message.includes("Password should")) message = "パスワードは8文字以上で、英字と数字を含む必要があります"
        if (message.includes("invalid email")) message = "有効なメールアドレスを入力してください"
        if (message.includes("validation failed")) message = "入力内容を確認してください。特にパスワードは英字と数字を含む8文字以上が必要です"
        setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(message) })
        return
      }
      // メール確認不要の場合はセッションが即座に発行される
      if (signUpData.session) {
        await onAuth(signUpData.session.user)
        return
      }
      // メール確認が必要な場合 → ログインタブに切り替え・メールアドレスを保持
      setIsLogin(true)
      // パスワードはクリアしない → ログインボタンをすぐ押せる
      setSignupMessage({
        type: "success",
        text: "確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。認証後は下のボタンでログインできます。",
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 animate-slide-up">
        <div className="text-center">
          <div className="mx-auto mb-3 w-16 h-16 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/70">
            <Image
              src="/logo-kakeibo.svg"
              alt="家計簿アプリ ロゴ"
              width={64}
              height={64}
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-white">家計簿アプリ</h1>
          <p className="text-slate-300 text-sm mt-1">AIと一緒に賢く管理</p>
          
          {/* アプリの説明 */}
          <div className="mt-6 text-left">
            <p className="text-xs text-slate-400 mb-3">📌 こんな人におすすめ</p>
            <div className="space-y-2 text-xs text-slate-300 mb-4">
              <div className="flex gap-2">
                <span>✓</span>
                <span>毎月の家計を把握したい</span>
              </div>
              <div className="flex gap-2">
                <span>✓</span>
                <span>予算をしっかり管理したい</span>
              </div>
              <div className="flex gap-2">
                <span>✓</span>
                <span>AI分析で支出の改善点を知りたい</span>
              </div>
              <div className="flex gap-2">
                <span>✓</span>
                <span>将来の収支予測を立てたい</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 mb-3">⚡ 主な機能</p>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex gap-2">
                <span>💳</span>
                <span>日々の収支を簡単に記録</span>
              </div>
              <div className="flex gap-2">
                <span>📊</span>
                <span>グラフで支出パターンを可視化</span>
              </div>
              <div className="flex gap-2">
                <span>🤖</span>
                <span>Claude AIがあなたの家計を分析</span>
              </div>
              <div className="flex gap-2">
                <span>📈</span>
                <span>月間・年間レポートで未来予測</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
            >
              ← 戻る
            </button>
          )}
          <div className="flex bg-slate-900 rounded-xl p-1">
            {(["ログイン", "新規登録"] as const).map((label, i) => (
              <button
                key={label}
                onClick={() => { setIsLogin(i === 0); setSignupMessage(null) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  (i === 0) === isLogin ? "bg-violet-600 text-white" : "text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {signupMessage && (
            <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
              signupMessage.type === "success"
                ? "bg-emerald-900/50 border border-emerald-700/60 text-emerald-200"
                : "bg-red-900/50 border border-red-700/60 text-red-200"
            }`}>
              {signupMessage.text}
            </div>
          )}

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
              onKeyDown={e => e.key === "Enter" && handlePasswordLogin()}
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
            onClick={handlePasswordLogin}
            disabled={loading || (!isLogin && !isPasswordValid(password))}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all"
          >
            {loading ? "処理中..." : isLogin ? "パスワードでログイン" : "登録する"}
          </button>
          {isLogin && (
            <div className="flex justify-between text-xs text-slate-400 pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="hover:text-slate-200 underline underline-offset-2 disabled:opacity-50"
              >
                パスワードを忘れた
              </button>
              <button
                type="button"
                onClick={handleResendConfirmationEmail}
                disabled={loading}
                className="hover:text-slate-200 underline underline-offset-2 disabled:opacity-50"
              >
                確認メール再送
              </button>
            </div>
          )}
          {isLogin && (
            <button
              type="button"
              onClick={handleMagicLinkLogin}
              disabled={loading}
              className="w-full py-2 text-xs text-slate-400 hover:text-white underline underline-offset-2 disabled:opacity-50"
            >
              メールリンクでログイン
            </button>
          )}
          {isLogin && (
            <button
              type="button"
              onClick={handleLineLogin}
              disabled={loading}
              className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all text-white text-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.06 2 11.07c0 4.5 3.59 8.26 8.45 8.93.31.07.74.2.85.47.1.24.06.6.03.84l-.14.82c-.04.24-.19.94.83.51 1.01-.43 5.47-3.22 7.46-5.51C20.82 15.34 22 13.33 22 11.07 22 6.06 17.52 2 12 2z"/>
              </svg>
              LINEでログイン
            </button>
          )}
          {isLogin && (
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2 text-xs text-slate-400 hover:text-white underline underline-offset-2 disabled:opacity-50"
            >
              デモアカウントでログイン
            </button>
          )}
        </div>

        {/* フッター */}
        <div className="text-center text-xs text-slate-500 space-y-2 mt-6 pt-4 border-t border-slate-700">
          <p>
            <Link href="/privacy" className="hover:text-slate-300 underline underline-offset-2">
              プライバシーポリシー
            </Link>
            {' '}
            <span>·</span>
            {' '}
            <Link href="/terms" className="hover:text-slate-300 underline underline-offset-2">
              利用規約
            </Link>
            {' '}
            <span>·</span>
            {' '}
            <Link href="/contact" className="hover:text-slate-300 underline underline-offset-2">
              お問い合わせ
            </Link>
          </p>
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
  const [showAuthView, setShowAuthView] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark"
    const saved = window.localStorage.getItem("kakeibo-theme")
    return saved === "light" || saved === "dark" ? saved : "dark"
  })
  const [accent, setAccent] = useState<"balanced" | "defense" | "growth">(() => {
    if (typeof window === "undefined") return "balanced"
    const saved = window.localStorage.getItem("kakeibo-accent")
    return saved === "defense" || saved === "growth" || saved === "balanced" ? saved : "balanced"
  })

  function toggleTheme() {
    setTheme(prev => (prev === "dark" ? "light" : "dark"))
  }

  function cycleAccent() {
    setAccent(prev => (prev === "balanced" ? "defense" : prev === "defense" ? "growth" : "balanced"))
  }

  const syncSessionToHome = useCallback(async (nextUser?: User | null) => {
    if (nextUser) {
      setUser(nextUser)
      setShowAuthView(false)
      return
    }

    const { data: { session } } = await createClient().auth.getSession()
    setUser(session?.user ?? null)
    setShowAuthView(false)
  }, [])

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

  async function handlePasswordChange() {
    const newPassword = window.prompt("新しいパスワードを入力してください（8文字以上・英字と数字を含む）")
    if (newPassword === null) return

    if (!isPasswordValid(newPassword)) {
      alert("パスワードは以下を満たす必要があります：\n・8文字以上\n・英字を含む (A-Z, a-z)\n・数字を含む (0-9)")
      return
    }

    const confirmPassword = window.prompt("確認のため、新しいパスワードをもう一度入力してください")
    if (confirmPassword === null) return

    if (newPassword !== confirmPassword) {
      alert("確認用パスワードが一致しません")
      return
    }

    const { error } = await createClient().auth.updateUser({ password: newPassword })
    if (error) {
      alert("パスワード変更失敗: " + error.message)
      return
    }

    alert("パスワードを変更しました")
  }

  // 認証チェック
  useEffect(() => {
    const supabase = createClient()

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const authError = params.get("auth_error")
      const oauthErrorDescription = params.get("error_description")
      const oauthError = params.get("error")
      const displayError = authError || oauthErrorDescription || oauthError

      if (displayError) {
        alert(decodeURIComponent(displayError))
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
        window.history.replaceState({}, "", cleanUrl)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setShowAuthView(false)
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
    window.localStorage.setItem("kakeibo-theme", theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === "undefined") return
    document.documentElement.setAttribute("data-accent", accent)
    window.localStorage.setItem("kakeibo-accent", accent)
  }, [accent])

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
          {theme === "dark" ? "ライト" : "ダーク"}
        </button>
        <button
          type="button"
          onClick={cycleAccent}
          className="fixed top-14 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          色:{accent === "balanced" ? "バランス" : accent === "defense" ? "守り" : "成長"}
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
            {theme === "dark" ? "ライト" : "ダーク"}
          </button>
          <button
            type="button"
            onClick={cycleAccent}
            className="fixed top-14 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
          >
            色:{accent === "balanced" ? "バランス" : accent === "defense" ? "守り" : "成長"}
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
        <button
          type="button"
          onClick={cycleAccent}
          className="fixed top-14 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          色:{accent === "balanced" ? "バランス" : accent === "defense" ? "守り" : "成長"}
        </button>
        <AuthView onAuth={syncSessionToHome} onBack={() => setShowAuthView(false)} />
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
        <button
          type="button"
          onClick={cycleAccent}
          className="fixed top-14 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          色:{accent === "balanced" ? "バランス" : accent === "defense" ? "守り" : "成長"}
        </button>
        <PresetSetup mode="create" onComplete={(nextProfile) => {
          setProfile(nextProfile)
          setNeedsSetup(false)
          setShowAuthView(false)
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
        <button
          type="button"
          onClick={cycleAccent}
          className="fixed top-14 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
        >
          色:{accent === "balanced" ? "バランス" : accent === "defense" ? "守り" : "成長"}
        </button>
        <PresetSetup
          mode="edit"
          initialProfile={profile}
          onCancel={() => setShowProfileSettings(false)}
          onComplete={(nextProfile) => {
            setProfile(nextProfile)
            setShowProfileSettings(false)
          }}
        />
      </>
    )
  }

  const [year, month] = currentMonth.split("-").map(Number)
  const monthLabel = `${year}年${month}月`
  const now = new Date()
  const isCurrentMonth = currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  return (
    <div className="min-h-screen bg-slate-950">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed top-3 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
      >
        {theme === "dark" ? "ライト" : "ダーク"}
      </button>
      <button
        type="button"
        onClick={cycleAccent}
        className="fixed top-14 right-3 z-50 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
      >
        色:{accent === "balanced" ? "バランス" : accent === "defense" ? "守り" : "成長"}
      </button>
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
                <button onClick={handleShare} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="共有">📤</button>
                <button onClick={exportCSV} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="CSV出力">📥</button>
              </>
            )}
            <button onClick={handlePasswordChange} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">PW変更</button>
            <button onClick={() => setShowProfileSettings(true)} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">初期設定変更</button>
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
              <Dashboard transactions={transactions} budgets={budgets} currentMonth={currentMonth} profile={profile} />
            )}
            {navPage === "input" && (
              <div className="space-y-4">
                <InputForm
                  recentTransactions={transactions}
                  onSuccess={tx => {
                    setTransactions(prev => [tx, ...prev])
                    setCurrentMonth(tx.date.slice(0, 7))
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
              <AIAnalysis
                transactions={transactions}
                budgets={budgets}
                currentMonth={currentMonth}
                profile={profile}
                onProfileUpdate={(next) => {
                  setProfile((prev) => {
                    if (!prev) return prev
                    return { ...prev, ...next }
                  })
                }}
              />
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
