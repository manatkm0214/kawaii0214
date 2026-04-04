"use client"

import { useState, FormEvent } from "react"
import Image from "next/image"
import { useCharacterImage } from "../../lib/hooks/useCharacterImage"

type ContactForm = {
  name: string
  email: string
  subject: string
  message: string
  provider: string // "claude" など
}

const initialForm: ContactForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
  provider: "claude",
}

function LogoImage() {
  const { characterUrl, characterName } = useCharacterImage()
  if (!characterUrl) return null
  return (
    <Image
      src={characterUrl}
      alt={characterName || "キャラクター"}
      width={80}
      height={80}
      className="w-20 h-20 rounded-full object-cover border-4 border-violet-400 shadow-idol animate-bounce-slow"
      unoptimized
    />
  )
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm)
  const [submitting] = useState(false)
  const [errorMsg] = useState<string | null>(null)

  function updateField<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // ここに送信処理
  }

  return (
    <main className="contact-screen min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-xl mx-auto py-10 space-y-6">
        <div className="flex flex-col items-center mb-6 justify-center">
          <LogoImage />
        </div>
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
              placeholder="your@email.com"
            />
          </label>
          <label className="block text-sm">
            件名
            <input
              type="text"
              value={form.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              className="contact-input mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
              placeholder="件名"
            />
          </label>
          <label className="block text-sm">
            メッセージ
            <textarea
              value={form.message}
              onChange={(e) => updateField("message", e.target.value)}
              className="contact-input mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5"
              placeholder="ご用件を入力してください"
              rows={4}
            />
          </label>
          <button
            type="submit"
            className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-2 px-4 rounded-xl"
            disabled={submitting}
          >
            送信
          </button>
        </form>
      </div>
    </main>
  )
}
