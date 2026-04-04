"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

import dynamic from "next/dynamic";
// LogoImageは存在しないため削除

function validatePassword(password: string): { ok: boolean; reason: string } {
  const normalized = password.normalize("NFKC").trim()
  if (normalized.length < 8) return { ok: false, reason: "8文字以上で入力してください" }
  return { ok: true, reason: "" }
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

const resetTypes = new Set<EmailOtpType>(["recovery", "email_change", "email"])

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function bootstrapRecoverySession() {
      if (typeof window === "undefined") return

      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const tokenHash = searchParams.get("token_hash")
      const typeParam = (searchParams.get("type") ?? "").toLowerCase()
      const code = searchParams.get("code")
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")

      setMessage(null)

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) {
          if (active) {
            setReady(true)
            window.history.replaceState({}, "", "/auth/reset-password")
          }
          return
        }
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          if (active) {
            setReady(true)
            window.history.replaceState({}, "", "/auth/reset-password")
          }
          return
        }
      }

      if (tokenHash && resetTypes.has(typeParam as EmailOtpType)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeParam as EmailOtpType })
        if (!error) {
          if (active) {
            setReady(true)
            window.history.replaceState({}, "", "/auth/reset-password")
          }
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        if (active) setReady(true)
        return
      }

      if (active) {
        setReady(false)
        setMessage("再設定リンクが無効か期限切れです。もう一度パスワード再設定メールを送ってください。")
      }
    }

    bootstrapRecoverySession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
      if (event === "SIGNED_IN" && session?.user) {
        setReady(true)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const validation = useMemo(() => validatePassword(password), [password])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!validation.ok) {
      alert(validation.reason)
      return
    }
    if (password !== confirm) {
      alert("確認用パスワードが一致しません")
      return
    }

    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password: toServerCompatiblePassword(password) })
    setLoading(false)

    if (error) {
      const raw = error.message.toLowerCase()
      if (raw.includes("password should contain at least one character of each")) {
        alert("パスワード更新失敗: 現在のサーバー設定では『小文字・大文字・数字・記号』をすべて含む必要があります（例: Abc12345!）")
        return
      }
      alert("パスワード更新失敗: " + error.message)
      return
    }

    alert("パスワードを更新しました。ログイン画面に戻ります。")
    router.replace("/")
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-6 justify-center">
        {/* <LogoImage /> 削除 */}
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-800/70 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h1 className="text-lg font-bold idol-title">パスワード再設定</h1>

        {!ready && (
          <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
            メールリンクからアクセスしてください。リンク有効化まで少し時間がかかる場合があります。
          </p>
        )}

        {message && (
          <p className="text-xs text-red-200 bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            {message}
          </p>
        )}

        <label className="block text-xs text-slate-300">
          新しいパスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
            placeholder="8文字以上・小文字・大文字・数字・記号を含む"
          />
          <p className="text-xs mt-1 text-slate-400">8文字以上・小文字・大文字・数字・記号をすべて含む必要があります（例: Abc12345!）</p>
          {password && !validatePassword(password).ok && (
            <p className="text-xs text-red-400 mt-1">✕ {validatePassword(password).reason}</p>
          )}
        </label>

        <label className="block text-xs text-slate-300">
          確認用パスワード
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-red-400 mt-1">✕ パスワードが一致しません</p>
          )}
        </label>

        <button
          type="submit"
          disabled={loading || !ready}
          className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "更新中..." : "パスワードを更新"}
        </button>
      </form>
    </main>
  );
}
