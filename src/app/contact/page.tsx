"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useCharacterImage } from "@/lib/hooks/useCharacterImage"
import { useLang } from "@/lib/hooks/useLang"
import { useBgTheme } from "@/lib/hooks/useBgTheme"

type ContactForm = {
  name: string
  email: string
  subject: string
  message: string
}

const initialForm: ContactForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
}

function LogoImage() {
  const { characterUrl, characterName } = useCharacterImage()

  if (!characterUrl) return null

  return (
    <Image
      src={characterUrl}
      alt={characterName || "Character image"}
      width={88}
      height={88}
      className="h-[88px] w-[88px] rounded-full border-4 border-cyan-300 object-cover shadow-lg shadow-cyan-950/30"
      unoptimized
    />
  )
}

export default function ContactPage() {
  useBgTheme()
  const lang = useLang()
  const t = (ja: string, en: string) => (lang === "en" ? en : ja)
  const [form, setForm] = useState<ContactForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function updateField<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lang }),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setErrorMsg(data.error || t("お問い合わせの送信に失敗しました。", "Could not send your message."))
        setSubmitting(false)
        return
      }

      setSuccessMsg(t("お問い合わせを送信しました。確認後にご連絡します。", "Your message was sent. We will review it and get back to you."))
      setForm(initialForm)
    } catch {
      setErrorMsg(t("お問い合わせの送信に失敗しました。", "Could not send your message."))
    }

    setSubmitting(false)
  }

  return (
    <main className="min-h-screen px-4 py-8 text-slate-100" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-3xl space-y-6 py-8">
        <section className="rounded-[32px] border border-white/10 bg-slate-900 px-6 py-8 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col items-center text-center">
            <LogoImage />
            <p className="mt-5 text-xs uppercase tracking-[0.32em] text-cyan-300/80">{t("お問い合わせ", "Contact")}</p>
            <h1 className="mt-3 text-3xl font-bold text-white">{t("かわいい家計簿", "Kawaii Kakeibo")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              {t(
                "不具合の報告、ご要望、改善してほしい点をこちらから送れます。内容を確認してから返信します。",
                "Send bug reports, requests, or anything you want improved here. We will review the message and reply after checking it.",
              )}
            </p>
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-[28px] border border-rose-400/30 bg-rose-950 px-5 py-4 text-sm text-rose-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-[28px] border border-emerald-400/30 bg-emerald-950 px-5 py-4 text-sm text-emerald-200">
            {successMsg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-[32px] border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-slate-950/30"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-200">
              {t("お名前", "Name")}
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                placeholder="Hanako Yamada"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              {t("メールアドレス", "Email")}
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                placeholder="your@email.com"
                required
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-200">
            {t("件名", "Subject")}
            <input
              type="text"
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              placeholder={t("カレンダーについて", "About the calendar")}
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-200">
            {t("内容", "Message")}
            <textarea
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              className="mt-2 min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              placeholder={t("発生したこと、期待していた動き、直したい点を書いてください。", "Tell us what happened, what you expected, and what you want to improve.")}
              rows={6}
              required
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? t("送信中...", "Sending...") : t("お問い合わせを送信", "Send message")}
            </button>
            <Link href="/" className="rounded-2xl border border-white/10 bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {t("ホームへ戻る", "Back to home")}
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
