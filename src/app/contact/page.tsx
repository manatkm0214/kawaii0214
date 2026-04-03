"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"


import type { AIProvider } from "../ai"

type ContactForm = {
  name: string
  email: string
  subject: string
  message: string
  provider: AIProvider
}

const initialForm: ContactForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
  provider: "claude",
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function updateField<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setErrorMsg("すべての項目を入力してください")
      return
    }

    setErrorMsg(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data?.error || "送信に失敗しました。時間をおいて再試行してください")
        return
      }

      setDone(true)
      setForm(initialForm)
    } catch {
      setErrorMsg("通信エラーが発生しました。時間をおいて再試行してください")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="contact-screen min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-xl mx-auto py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">お問い合わせフォーム</h1>
          <p className="text-sm text-slate-400 mt-2">不具合報告・要望・ご質問を受け付けています。</p>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-700/60 rounded-xl px-4 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="contact-panel bg-slate-800/70 border border-slate-700 rounded-2xl p-6 space-y-4">
          <label className="block text-sm">
            お名前
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="contact-input mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
              placeholder="山田 太郎"
            />
          </label>

          <label className="block text-sm">
            メールアドレス
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="contact-input mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
              placeholder="example@mail.com"
            />
          </label>

          <label className="block text-sm">
            件名
            <input
              type="text"
              value={form.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              className="contact-input mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
              placeholder="ログインについて"
            />
          </label>

          <label className="block text-sm">
            内容
            <textarea
              value={form.message}
              onChange={(e) => updateField("message", e.target.value)}
              className="contact-input mt-1 w-full min-h-36 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
              placeholder="お問い合わせ内容をご記入ください"
            />
          </label>


          <label className="block text-sm">
            AIプロバイダー選択
            <select
              value={form.provider}
              onChange={e => updateField("provider", e.target.value as AIProvider)}
              className="contact-input mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
            >
              <option value="claude">Claude（Anthropic）</option>
              <option value="openai">OpenAI（ChatGPT）</option>
              <option value="gemini">Gemini（Google）</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? "送信中..." : "送信する"}
          </button>

          {done && (
            <p className="text-sm text-emerald-300">お問い合わせを受け付けました。ご連絡ありがとうございます。</p>
          )}
        </form>

        <div className="text-sm text-slate-400 flex gap-3">
          <Link href="/" className="underline underline-offset-2 hover:text-slate-200">ホームに戻る</Link>
          <Link href="/auth/reset-password" className="underline underline-offset-2 hover:text-slate-200">パスワード再設定へ</Link>
        </div>
      </div>
    </main>
  )
}
