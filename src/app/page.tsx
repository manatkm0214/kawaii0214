"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import Link from "next/link"
import Image from "next/image"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Transaction, Budget, Profile, NavPage, formatCurrency } from "@/lib/utils"
import MoneyAnimation from "@/lib/components/MoneyAnimation"
import Dashboard from "@/lib/components/Dashboard"
import InputForm from "@/lib/components/InputForm"
import Charts from "@/lib/components/Charts"
import AIAnalysis from "@/lib/components/AIAnalysis"
import AnnualReport from "@/lib/components/AnnualReport"
import Calendar from "@/lib/components/Calendar"
import PresetSetup from "@/lib/components/PresetSetup"
import AccountSettings from "@/lib/components/AccountSettings"
import GoalsAndDebt from "@/lib/components/GoalsAndDebt"

function isPasswordValid(pwd: string): boolean {
  return pwd.normalize("NFKC").trim().length >= 8
}

function normalizeAuthIdentifier(raw: string): string {
  const normalized = raw.normalize("NFKC").trim().toLowerCase()
  if (!normalized) return ""
  if (normalized.includes("@")) return normalized

  const safe = normalized.replace(/[^a-z0-9._-]/g, "")
  const fallbackLocal = safe || `user${Date.now()}`
  return `${fallbackLocal}@kakeibo.local`
}

function toServerCompatiblePassword(raw: string): string {
  let next = raw.normalize("NFKC").trim()
  if (!/[a-z]/.test(next)) next += "a"
  if (!/[A-Z]/.test(next)) next += "A"
  if (!/[0-9]/.test(next)) next += "1"
  if (!/[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~]/.test(next)) next += "!"
  if (next.length < 8) next = next.padEnd(8, "x")
  return next
}

function readStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  const saved = window.localStorage.getItem("kakeibo-theme")
  return saved === "light" || saved === "dark" ? saved : "dark"
}

function subscribeThemeChange(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}

  const handleChange = () => onStoreChange()
  window.addEventListener("storage", handleChange)
  window.addEventListener("kakeibo-theme-updated", handleChange)

  return () => {
    window.removeEventListener("storage", handleChange)
    window.removeEventListener("kakeibo-theme-updated", handleChange)
  }
}

function subscribeNoop(): () => void {
  return () => {}
}

function toFriendlyAuthErrorMessage(raw: string): string {
  const message = raw.toLowerCase()

  if (message.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが間違っています"
  }
  if (message.includes("email not confirmed")) {
    return "メール認証が完了していません。受信メールをご確認ください"
  }
  if (
    message.includes("too many requests") ||
    message.includes("over_email_send_rate_limit") ||
    message.includes("email rate limit exceeded")
  ) {
    return "メール送信の上限に達しました。60秒以上あけてから再試行してください"
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "通信エラーです。ネットワーク接続を確認してください"
  }
  if (message.includes("invalid api key") || message.includes("invalid_api_key")) {
    return "認証設定に問題があります。管理者にお問い合わせください"
  }
  if (message.includes("password should contain at least one character of each")) {
    return "現在のサーバー設定では、8文字以上かつ『小文字・大文字・数字・記号』をすべて含む必要があります（例: Abc12345!）"
  }
  if (
    message.includes("token") &&
    (message.includes("expired") || message.includes("invalid") || message.includes("not found"))
  ) {
    return "メールリンクの有効期限切れ、またはリンクが無効です。最新のメールを開いて再試行してください"
  }
  if (message.includes("otp") && (message.includes("expired") || message.includes("invalid"))) {
    return "PINコードの有効期限が切れているか、コードが正しくありません。最新のPINを確認してください"
  }
  if (message.includes("code verifier") || message.includes("flow state")) {
    return "認証リンクが無効です。最新のメールリンクからもう一度ログインしてください"
  }
  if (message.includes("jwt")) {
    return "セッションエラーが発生しました。ページを再読み込みして再試行してください"
  }
  if (message.includes("provider") && message.includes("disabled")) {
    return "このログイン方式は現在無効です。管理者に有効化を依頼してください"
  }
  if (message.includes("provider line could not be found") || message.includes("unsupported provider") && message.includes("line")) {
    return "この環境ではLINEログインが未対応です。メールリンクまたはPINコードでログインしてください"
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
  const baseCandidates = [
    rawPassword,
    rawPassword.normalize("NFKC"),
    rawPassword.trim(),
    rawPassword.normalize("NFKC").trim(),
  ]

  const candidates = [...baseCandidates]
  for (const candidate of baseCandidates) {
    candidates.push(toServerCompatiblePassword(candidate))
  }

  return [...new Set(candidates)]
}

const EMAIL_COOLDOWN_STORAGE_KEY = "kakeibo_email_cooldown_until"

// ─── Auth View ──────────────────────────────────────────────────────────────
function WelcomeView({ onStartAuth }: { onStartAuth: () => void }) {
  return (
    <div className="entry-screen w-screen h-screen min-h-0 min-w-0 max-w-none max-h-none bg-slate-950 flex items-center justify-center p-0">
      <div className="w-full max-w-3xl space-y-10 animate-slide-up">
        <div className="text-center">
          <div className="entry-logo-box mx-auto mb-6 w-40 h-40 rounded-3xl overflow-hidden border-4 border-slate-700/60 bg-slate-900/70">
            <Image
              src="/logo-kakeibo.svg"
              alt="家計簿アプリ ロゴ"
              width={80}
              height={80}
              priority
            />
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-2">家計簿アプリ</h1>
          <p className="text-slate-300 text-2xl mt-2">AIと一緒に賢く管理</p>
        </div>

        <div className="entry-panel bg-slate-800/80 border-2 border-slate-700/80 rounded-3xl p-12 space-y-8 w-full max-w-2xl mx-auto">
          <p className="text-xl text-slate-200 leading-relaxed font-semibold">
            支出の記録、予算管理、将来予測までを1つにまとめた家計管理アプリです。
          </p>
          <ul className="text-lg text-slate-300 space-y-4 list-disc list-inside">
            <li>日々の収支をかんたん入力</li>
            <li>グラフとレポートで家計を見える化</li>
            <li>AI分析で改善アクションを提案</li>
          </ul>
          <button
            type="button"
            onClick={onStartAuth}
            className="w-full py-6 bg-violet-600 hover:bg-violet-500 rounded-2xl font-extrabold text-2xl transition-all text-white"
          >
            ログイン / 新規登録へ進む
          </button>
          <div className="text-center text-lg text-slate-400 mt-8">
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
    {/* 右下に常時キャラクター表示 */}
    <div style={{position: "fixed", bottom: 24, right: 24, zIndex: 50, pointerEvents: "none"}}>
      <div className="hidden md:block transition-all opacity-60 hover:opacity-100 pointer-events-auto">
        <MoneyAnimation mascot />
      </div>
    </div>
    </div>
  )
}

function AuthView({ onAuth, onBack, initialMessage, initialEmail, onGuestLogin }: { onAuth: (nextUser?: User | null) => Promise<void> | void; onBack?: () => void; initialMessage?: { type: "success" | "error"; text: string } | null; initialEmail?: string; onGuestLogin?: () => Promise<void> }) {
  const [isLogin, setIsLogin] = useState(true)
  const [guestLoading, setGuestLoading] = useState(false)

  async function handleGuestLogin() {
    if (!onGuestLogin) return
    setGuestLoading(true)
    await onGuestLogin()
    setGuestLoading(false)
  }
  const [email, setEmail] = useState(initialEmail ?? "")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailCooldownUntil, setEmailCooldownUntil] = useState(0)
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now())
  const [signupMessage, setSignupMessage] = useState<{ type: "success" | "error"; text: string } | null>(initialMessage ?? null)
  const [postSignupResendEmail, setPostSignupResendEmail] = useState<string | null>(null)
  const [lineAuthUrl, setLineAuthUrl] = useState<string | null>(null)
  const [lineQrUrl, setLineQrUrl] = useState<string | null>(null)
  const [showLineQr, setShowLineQr] = useState(false)
  const lineLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_LINE_LOGIN === "true"
  const emailCooldownSeconds = Math.max(0, Math.ceil((emailCooldownUntil - currentTimeMs) / 1000))

  useEffect(() => {
    if (!initialEmail) return
    setEmail(initialEmail)
  }, [initialEmail])

  useEffect(() => {
    if (!initialMessage) return
    setSignupMessage(initialMessage)
  }, [initialMessage])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(EMAIL_COOLDOWN_STORAGE_KEY)
    if (!stored) return

    const cooldownUntil = Number(stored)
    if (Number.isFinite(cooldownUntil) && cooldownUntil > Date.now()) {
      setEmailCooldownUntil(cooldownUntil)
      setCurrentTimeMs(Date.now())
      return
    }

    window.localStorage.removeItem(EMAIL_COOLDOWN_STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (emailCooldownUntil <= Date.now()) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(EMAIL_COOLDOWN_STORAGE_KEY)
      }
      return
    }

    const timer = window.setInterval(() => {
      const now = Date.now()
      setCurrentTimeMs(now)
      if (now >= emailCooldownUntil) {
        setEmailCooldownUntil(0)
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [emailCooldownUntil])

  function isEmailRateLimitError(raw: string): boolean {
    const message = raw.toLowerCase()
    return (
      message.includes("over_email_send_rate_limit") ||
      message.includes("email rate limit exceeded") ||
      (message.includes("too many requests") && message.includes("email"))
    )
  }

  function getRateLimitWaitSeconds(raw: string, fallbackSeconds = 65): number {
    const message = raw.toLowerCase()
    const matches = [
      message.match(/(?:in|after)\s*(\d+)\s*(?:seconds?|sec|s)?/i),
      message.match(/(\d+)\s*秒/),
      message.match(/(\d+)\s*(?:seconds?|sec|s)/i),
    ]

    for (const matched of matches) {
      const value = Number(matched?.[1])
      if (Number.isFinite(value) && value > 0) {
        return Math.min(Math.max(value + 2, 5), 600)
      }
    }

    return fallbackSeconds
  }

  function startEmailCooldown(seconds = 65) {
    const safeSeconds = Math.min(Math.max(seconds, 5), 600)
    const cooldownUntil = Date.now() + safeSeconds * 1000
    setCurrentTimeMs(Date.now())
    setEmailCooldownUntil(cooldownUntil)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EMAIL_COOLDOWN_STORAGE_KEY, String(cooldownUntil))
    }
  }

  function ensureEmailSendAvailable(): boolean {
    if (emailCooldownSeconds <= 0) return true
    setSignupMessage({ type: "error", text: `メール送信は ${emailCooldownSeconds} 秒後に再試行できます。` })
    return false
  }

  async function createLineAuthUrl() {
    const response = await fetch("/api/auth/line/start", { method: "GET" })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok || !payload?.authUrl) {
      const message = typeof payload?.error === "string" && payload.error
        ? payload.error
        : "LINEログインの準備に失敗しました。しばらくしてから再試行してください。"
      throw new Error(message)
    }

    setLineAuthUrl(payload.authUrl)
    setLineQrUrl(payload.qrUrl ?? null)
    return payload.authUrl as string
  }

  async function handlePasswordLogin() {
    await handleSubmit()
  }

  async function handleForgotPassword() {
    const normalizedEmail = normalizeAuthIdentifier(email)

    if (!normalizedEmail) {
      setSignupMessage({ type: "error", text: "メールアドレスを入力してからパスワード再設定リンクを押してください" })
      return
    }
    if (!ensureEmailSendAvailable()) return

    setLoading(true)
    const callbackUrl = getPasswordResetUrl()
    const { error } = await createClient().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: callbackUrl,
    })
    setLoading(false)

    if (error) {
      if (isEmailRateLimitError(error.message)) startEmailCooldown(getRateLimitWaitSeconds(error.message))
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    startEmailCooldown()
    setSignupMessage({ type: "success", text: `${normalizedEmail} にパスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。` })
  }

  async function handleResendConfirmationEmail() {
    const normalizedEmail = normalizeAuthIdentifier(email)

    if (!normalizedEmail) {
      setSignupMessage({ type: "error", text: "メールアドレスを入力してから確認メール再送を押してください" })
      return
    }
    if (!ensureEmailSendAvailable()) return

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
      if (isEmailRateLimitError(error.message)) startEmailCooldown(getRateLimitWaitSeconds(error.message))
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    startEmailCooldown()
    setSignupMessage({ type: "success", text: `${normalizedEmail} に確認メールを再送しました。受信メールのリンクをクリックして認証を完了してください。` })
  }

  async function handlePostSignupResend() {
    if (!postSignupResendEmail) {
      setSignupMessage({ type: "error", text: "再送先メールアドレスが見つかりません。メールアドレスを入力して確認メール再送を押してください" })
      return
    }
    if (!ensureEmailSendAvailable()) return

    setLoading(true)
    const callbackUrl = getAuthCallbackUrl()
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: postSignupResendEmail,
      options: {
        emailRedirectTo: callbackUrl,
      },
    })
    setLoading(false)

    if (error) {
      if (isEmailRateLimitError(error.message)) startEmailCooldown(getRateLimitWaitSeconds(error.message))
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      return
    }

    startEmailCooldown()
    setSignupMessage({ type: "success", text: `${postSignupResendEmail} に確認メールを再送しました。届かない場合は迷惑メールフォルダも確認してください。` })
  }

  function handleSpamFolderHelp() {
    if (!postSignupResendEmail) {
      setSignupMessage({ type: "error", text: "メールアドレスを入力してから確認メール再送をお試しください。" })
      return
    }

    setSignupMessage({
      type: "success",
      text: `${postSignupResendEmail} 宛メールについて、迷惑メール・プロモーション・受信拒否設定を確認してください。見つからない場合は下の「別メールで再登録」をお試しください。`,
    })
  }

  function handleRetryWithAnotherEmail() {
    setIsLogin(false)
    setPostSignupResendEmail(null)
    setEmail("")
    setSignupMessage({ type: "success", text: "別のメールアドレスで新規登録できます。メールアドレスを入力して登録してください。" })
  }

  async function handleLineLogin() {
    if (!lineLoginEnabled) {
      setSignupMessage({ type: "error", text: "この環境ではLINEログインが未対応です。パスワードログインをご利用ください。" })
      return
    }

    setSignupMessage(null)
    setLineAuthUrl(null)
    setLineQrUrl(null)
    setLoading(true)
    try {
      const authUrl = await createLineAuthUrl()
      setSignupMessage({ type: "success", text: "LINEログイン画面へ移動します。PCではQRが使えます。開かない場合は下のリンクを押してください。" })
      setLoading(false)
      window.location.assign(authUrl)
    } catch (error) {
      setLoading(false)
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error instanceof Error ? error.message : "LINEログインに失敗しました") })
    }
  }

  async function handleShowLineQr() {
    if (!lineLoginEnabled) {
      setSignupMessage({ type: "error", text: "この環境ではLINEログインが未対応です。" })
      return
    }

    setLoading(true)
    try {
      await createLineAuthUrl()
      setShowLineQr(true)
      setSignupMessage({ type: "success", text: "QRを表示しました。スマホのLINEで読み取ってください。" })
    } catch (error) {
      setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(error instanceof Error ? error.message : "LINE QRの生成に失敗しました") })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    const normalizedEmail = normalizeAuthIdentifier(email)
    const normalizedPassword = password.normalize("NFKC").trim()
    const supabase = createClient()

    setSignupMessage(null)

    if (!normalizedEmail || !password) { setSignupMessage({ type: "error", text: "メールアドレスとパスワードを入力してください" }); return }
    if (!isLogin && !isPasswordValid(normalizedPassword)) {
      setSignupMessage({ type: "error", text: "パスワードは8文字以上で入力してください" })
      return
    }
    if (!isLogin && !ensureEmailSendAvailable()) return
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
          setSignupMessage({ type: "error", text: friendly + "　→ 下の「パスワードを忘れた」から再設定できます" })
        } else if (friendly.includes("メール認証が完了していません")) {
          setSignupMessage({ type: "error", text: friendly + "　→ 下の「確認メール再送」で再送できます" })
        } else {
          setSignupMessage({ type: "error", text: friendly })
        }
        return 
      }
      await onAuth(signedInUser)
      setPostSignupResendEmail(null)
    } else {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: toServerCompatiblePassword(normalizedPassword),
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      })
      setLoading(false)
      if (error) {
        setPostSignupResendEmail(null)
        if (isEmailRateLimitError(error.message)) {
          startEmailCooldown(getRateLimitWaitSeconds(error.message))
        }
        const lowerMessage = error.message.toLowerCase()
        const alreadyRegistered = lowerMessage.includes("already registered") || lowerMessage.includes("already exists")
        if (alreadyRegistered) {
          setIsLogin(true)
          setPostSignupResendEmail(normalizedEmail)
          setSignupMessage({
            type: "error",
            text: "このメールアドレスは既に登録されています。ログインに切り替えました。メール未認証の場合は「確認メール再送」、忘れた場合は「パスワードを忘れた」をお使いください。",
          })
          return
        }
        let message = error.message || "不明なエラーが発生しました"
        if (message.includes("Invalid API key") || message.includes("invalid_api_key")) message = "Supabaseの設定に問題があります。管理者にお問い合わせください。"
        if (message.includes("Password should")) {
          message = "現在のサーバー設定では、8文字以上かつ『小文字・大文字・数字・記号』をすべて含む必要があります（例: Abc12345!）"
        }
        if (message.includes("invalid email")) message = "有効なメールアドレスを入力してください"
        if (message.includes("validation failed")) message = "入力内容を確認してください。パスワードは8文字以上で入力してください"
        setSignupMessage({ type: "error", text: toFriendlyAuthErrorMessage(message) })
        return
      }
      // メール確認不要の場合はセッションが即座に発行される
      if (signUpData.session) {
        setPostSignupResendEmail(null)
        await onAuth(signUpData.session.user)
        return
      }
      // メール確認が必要な場合 → ログインタブに切り替え・メールアドレスを保持
      setIsLogin(true)
      setPostSignupResendEmail(normalizedEmail)
      // パスワードはクリアしない → ログインボタンをすぐ押せる
      setSignupMessage({
        type: "success",
        text: "確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。認証後は下のボタンでログインできます。",
      })
    }
  }

  return (
    <div className="entry-screen min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 animate-slide-up">
        <div className="text-center">
          <div className="entry-logo-box mx-auto mb-3 w-16 h-16 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/70">
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

        <div className="entry-panel bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
            >
              ← 戻る
            </button>
          )}
          <div className="entry-tab-strip flex bg-slate-900 rounded-xl p-1">
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
                ? "bg-emerald-950 border border-emerald-500/70 text-emerald-50 shadow-lg shadow-emerald-950/30"
                : "bg-red-950 border border-red-500/70 text-red-50 shadow-lg shadow-red-950/30"
            }`}>
              <p className="font-semibold mb-1">{signupMessage.type === "success" ? "完了メッセージ" : "エラーメッセージ"}</p>
              <p>{signupMessage.text}</p>
            </div>
          )}

          {isLogin && postSignupResendEmail && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePostSignupResend}
                disabled={loading || emailCooldownSeconds > 0}
                className="w-full py-2 text-xs text-emerald-200 bg-emerald-900/40 border border-emerald-700/60 hover:bg-emerald-900/60 rounded-xl disabled:opacity-50"
              >
                確認メールをもう一度送る（ワンクリック）
              </button>
              <div className="flex items-center justify-between text-[11px] text-slate-300 px-1">
                <button
                  type="button"
                  onClick={handleSpamFolderHelp}
                  className="underline underline-offset-2 hover:text-white"
                >
                  迷惑メールフォルダを確認
                </button>
                <button
                  type="button"
                  onClick={handleRetryWithAnotherEmail}
                  className="underline underline-offset-2 hover:text-white"
                >
                  別メールで再登録
                </button>
              </div>
            </div>
          )}

          <input
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="メールアドレス or 任意ID"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="entry-input w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
          />
          <p className="text-[11px] text-slate-500 -mt-2">@なし入力もOK（内部でIDとして処理）</p>
          <div>
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePasswordLogin()}
              className="entry-input w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            />
            {!isLogin && password && (
              <div className="text-xs mt-2">
                {password.normalize("NFKC").trim().length >= 8
                  ? <p className="text-emerald-400">✓ OK（{password.length}文字）</p>
                  : <p className="text-slate-400">✕ あと{8 - password.normalize("NFKC").trim().length}文字必要</p>
                }
              </div>
            )}
          </div>
          <button
            onClick={handlePasswordLogin}
            disabled={loading || (!isLogin && (!isPasswordValid(password) || emailCooldownSeconds > 0))}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all"
          >
            {loading ? "処理中..." : isLogin ? "パスワードでログイン" : "登録する"}
          </button>
          {isLogin && (
            <p className="text-[11px] text-slate-400">ログイン方法: パスワード / LINE</p>
          )}
          {emailCooldownSeconds > 0 && (
            <p className="text-[11px] text-amber-300">メール送信は {emailCooldownSeconds} 秒後に再試行できます。</p>
          )}
          {isLogin && (
            <div className="flex justify-between text-xs text-slate-400 pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading || emailCooldownSeconds > 0}
                className="hover:text-slate-200 underline underline-offset-2 disabled:opacity-50"
              >
                パスワードを忘れた
              </button>
              <button
                type="button"
                onClick={handleResendConfirmationEmail}
                disabled={loading || emailCooldownSeconds > 0}
                className="hover:text-slate-200 underline underline-offset-2 disabled:opacity-50"
              >
                確認メール再送
              </button>
            </div>
          )}
          {isLogin && lineLoginEnabled && (
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
          {isLogin && lineLoginEnabled && (
            <button
              type="button"
              onClick={handleShowLineQr}
              disabled={loading}
              className="w-full py-2 text-xs text-slate-300 hover:text-white underline underline-offset-2 disabled:opacity-50"
            >
              LINE QRを表示
            </button>
          )}
          {isLogin && lineLoginEnabled && lineAuthUrl && (
            <a
              href={lineAuthUrl}
              className="block w-full py-2 text-center text-xs text-slate-300 hover:text-white underline underline-offset-2"
            >
              LINEログイン画面が開かない場合はこちら
            </a>
          )}
          {isLogin && lineLoginEnabled && showLineQr && lineQrUrl && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 space-y-2">
              <p className="text-xs text-slate-300 text-center">スマホLINEで読み取り</p>
              <Image
                src={lineQrUrl}
                alt="LINEログインQR"
                width={176}
                height={176}
                unoptimized
                className="mx-auto w-44 h-44 rounded-lg bg-white p-2"
              />
            </div>
          )}
          {isLogin && !lineLoginEnabled && (
            <button
              type="button"
              disabled
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-slate-700/50 border border-slate-600 text-slate-400 cursor-not-allowed"
              title="NEXT_PUBLIC_ENABLE_LINE_LOGIN=true とLINE設定が必要です"
            >
              LINEでログイン（設定中）
            </button>
          )}

          {onGuestLogin && (
            <div className="pt-1">
              <div className="relative flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-[11px] text-slate-500 shrink-0">または</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={guestLoading || loading}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-slate-700/60 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {guestLoading ? "準備中..." : "👤 ゲストとして試す（登録不要）"}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-1.5">ログアウトするとデータは消えます</p>
            </div>
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
  const [showAccountSettings, setShowAccountSettings] = useState(false)
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

  const syncSessionToHome = useCallback(async (nextUser?: User | null) => {
    if (nextUser) {
      setUser(nextUser)
      setShowAuthView(false)
      setAuthNotice(null)
      setAuthPrefillEmail("")
      return
    }

    const { data: { session } } = await createClient().auth.getSession()
    if (session?.user) {
      setUser(session.user)
      setShowAuthView(false)
      setAuthNotice(null)
      setAuthPrefillEmail("")
      return
    }

    setUser(null)
    setShowAuthView(true)
    setAuthNotice({ type: "error", text: "ログイン状態を確認できませんでした。もう一度ログインしてください。" })
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

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setShowAuthView(true)
        setAuthNotice({ type: "error", text: toFriendlyAuthErrorMessage(error.message) })
      }

      if (!session?.user && pendingAuthErrorMessage) {
        setShowAuthView(true)
        setAuthNotice({ type: "error", text: pendingAuthErrorMessage })
      }

      if (!session?.user && pendingLineOauth) {
        setShowAuthView(true)
        if (pendingLineEmail) {
          setAuthPrefillEmail(pendingLineEmail)
          setAuthNotice({ type: "success", text: "LINE本人確認が完了しました。メールのPINコード認証でログインを完了してください。" })
        } else {
          setAuthNotice({ type: "error", text: "LINE認証は完了しましたが、メール情報を取得できませんでした。メールログインをご利用ください。" })
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
            <button onClick={() => setShowAccountSettings(true)} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">設定</button>
            <button onClick={() => setShowProfileSettings(true)} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">目標</button>
            <button onClick={handleSignOut} className="text-xs px-2 py-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-red-600/30 transition-colors">ログアウト</button>
          </div>
        </div>
      </header>

      {/* 3カラムボディ */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* 左カラム (2) — サイドナビ */}
        <aside className="flex-2 min-w-0 flex flex-col bg-slate-900 border-r border-slate-800 overflow-y-auto no-print">
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
        <main className="flex-5 min-w-0 overflow-y-auto">
          <div className="p-4 min-h-full">
            {dataLoading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-400 animate-pulse">データ読み込み中...</p>
              </div>
            ) : (
              <>
                {(navPage === "dashboard" || navPage === "input") && (
                  <Dashboard
                    transactions={transactions}
                    budgets={budgets}
                    currentMonth={currentMonth}
                    profile={profile}
                    onOpenSetup={() => setShowProfileSettings(true)}
                  />
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

        {/* 右カラム (3) — 入力フォーム＋履歴 */}
        <aside className="flex-3 min-w-0 overflow-y-auto border-l border-slate-800 bg-slate-900/40">
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
    </div>
  )
}
