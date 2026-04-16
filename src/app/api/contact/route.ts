import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

type ContactPayload = {
  name?: string
  email?: string
  subject?: string
  message?: string
  lang?: string
}

function buildAdminEmail(payload: Required<Omit<ContactPayload, "lang">> & { lang: string }) {
  const isEn = payload.lang === "en"
  const escapedMessage = payload.message.replace(/\n/g, "<br />")
  const title = isEn ? "未来設計ノート — New Inquiry" : "未来設計ノート お問い合わせ"
  const labels = isEn
    ? { name: "Name", email: "Email", subject: "Subject", message: "Message" }
    : { name: "お名前", email: "メールアドレス", subject: "件名", message: "内容" }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a;">
      <h2 style="margin-bottom: 16px;">${title}</h2>
      <p><strong>${labels.name}:</strong> ${payload.name}</p>
      <p><strong>${labels.email}:</strong> ${payload.email}</p>
      <p><strong>${labels.subject}:</strong> ${payload.subject}</p>
      <div style="margin-top: 20px;">
        <strong>${labels.message}:</strong>
        <div style="margin-top: 8px; padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
          ${escapedMessage}
        </div>
      </div>
    </div>
  `
}

function buildReplyEmail(payload: Required<Omit<ContactPayload, "lang">> & { lang: string }) {
  const isEn = payload.lang === "en"

  if (isEn) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
        <p>Hi ${payload.name},</p>
        <p>Thank you for contacting us. We have received your message and will get back to you after reviewing it.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #64748b; font-size: 13px;"><strong>Subject:</strong> ${payload.subject}</p>
        <p style="color: #64748b; font-size: 13px;"><strong>Message:</strong><br />${payload.message.replace(/\n/g, "<br />")}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">未来設計ノート</p>
      </div>
    `
  }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
      <p>${payload.name} 様</p>
      <p>お問い合わせいただきありがとうございます。内容を確認の上、ご連絡いたします。</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #64748b; font-size: 13px;"><strong>件名:</strong> ${payload.subject}</p>
      <p style="color: #64748b; font-size: 13px;"><strong>内容:</strong><br />${payload.message.replace(/\n/g, "<br />")}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">未来設計ノート</p>
    </div>
  `
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ContactPayload
    const name = body.name?.trim() || ""
    const email = body.email?.trim() || ""
    const subject = body.subject?.trim() || ""
    const message = body.message?.trim() || ""
    const lang = body.lang === "en" ? "en" : "ja"

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "必須項目を入力してください。" }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim()
    const toEmail = process.env.CONTACT_TO_EMAIL?.trim()
    const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim()

    if (!resendApiKey || !toEmail || !fromEmail) {
      return NextResponse.json({ error: "お問い合わせ送信の設定が未完了です。" }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const adminSubject = lang === "en" ? `[Inquiry] ${subject}` : `【お問い合わせ】${subject}`
    const replySubject = lang === "en" ? `Re: ${subject}` : `【受付完了】${subject}`

    const adminResult = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: adminSubject,
      html: buildAdminEmail({ name, email, subject, message, lang }),
    })

    if (adminResult.error) {
      return NextResponse.json({ error: "お問い合わせの送信に失敗しました。" }, { status: 500 })
    }

    // 自動返信は失敗してもエラーにしない（送信元ドメインの制限がある場合があるため）
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: replySubject,
      html: buildReplyEmail({ name, email, subject, message, lang }),
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "お問い合わせの送信に失敗しました。" }, { status: 500 })
  }
}
