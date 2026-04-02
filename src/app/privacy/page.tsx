'use client'

import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-slate-900/60 border border-slate-700/50 rounded-2xl p-8">
        <h1 className="text-4xl font-bold text-white mb-2">プライバシーポリシー</h1>
        <p className="text-slate-400 mb-8">最終更新: 2026年4月2日</p>

        <div className="space-y-6 text-slate-300">
          <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">📌 本アプリについて</h2>
            <p className="text-sm text-slate-300 mb-3">
              本アプリケーションは、家計管理をシンプルかつ効果的にするための家計簿アプリです。毎日の収支記録から月間・年間レポートの自動生成、Claude AIによる財務分析まで、あなたの家計を多角的に支援します。
            </p>
            <div className="text-sm text-slate-400 space-y-1">
              <p>🎯 <span className="font-semibold">目的</span>: 家計の可視化と賢い家計管理</p>
              <p>👥 <span className="font-semibold">対象</span>: 家計を管理したいすべての人</p>
              <p>🔒 <span className="font-semibold">方針</span>: プライバシーを最優先に設計</p>
            </div>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. はじめに</h2>
            <p>
              本アプリケーション（以下「当アプリ」）は、ユーザーのプライバシーを尊重し、個人情報の保護に最大限の努力をいたします。このプライバシーポリシー（以下「本ポリシー」）は、当アプリがどのように情報を収集、使用、保護するかについて説明しています。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. 収集する情報</h2>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">2.1 ユーザーが直接提供する情報</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>メールアドレス</li>
              <li>パスワード</li>
              <li>プロフィール情報</li>
              <li>家計管理に関するデータ（収入、支出、予算情報）</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-200 mb-2 mt-4">2.2 自動的に収集される情報</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>IPアドレス</li>
              <li>ブラウザ情報、OSタイプ</li>
              <li>訪問日時およびアクセスパターン</li>
              <li>デバイス情報</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. 情報の使用目的</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>ユーザー認証および本人確認</li>
              <li>家計管理サービスの提供</li>
              <li>AI分析機能による財務アドバイスの提供</li>
              <li>サービス改善および最適化</li>
              <li>セキュリティおよび不正防止</li>
              <li>ユーザーサポートおよびカスタマーサービス</li>
              <li>法的義務の遵守</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. AI分析機能について</h2>
            <p className="mb-2">
              当アプリはClaudeAIを活用した財務分析機能を提供しています。以下の点にご注意ください：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>分析のため、ユーザーの家計データがClaudeAIに送信されます</li>
              <li>送信されるデータには個人を特定する情報は含まれません</li>
              <li>AIプロバイダーのプライバシーポリシーも適用されます</li>
              <li>ユーザーはいつでもAI分析機能の利用を停止できます</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. 情報の保護</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>すべてのデータはSupabaseの暗号化されたサーバーに保存されます</li>
              <li>通信はSSL/TLSプロトコルで暗号化されます</li>
              <li>適切なアクセス制御とセキュリティ措置を実装しています</li>
              <li>定期的なセキュリティ監査を実施しています</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. 情報の共有</h2>
            <p>
              当アプリは、以下の場合を除きユーザーの個人情報を第三者と共有しません：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>ユーザーの明示的な同意がある場合</li>
              <li>法的義務により要求された場合</li>
              <li>Supabase（データベースサービスプロバイダー）</li>
              <li>Claude AI（分析機能提供者）</li>
              <li>認証プロバイダー（Google、GitHub、LINE）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. ユーザーの権利</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>自身の個人情報へのアクセス権</li>
              <li>情報の修正或いは削除を要求する権利</li>
              <li>情報処理の中止を要求する権利</li>
              <li>アカウントの削除を要求する権利</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Cookieについて</h2>
            <p>
              当アプリはセッション管理および機能向上のためにCookieを使用することがあります。ブラウザの設定でCookieを無効化できますが、一部の機能が正常に動作しない可能性があります。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. ポリシーの変更</h2>
            <p>
              当アプリは本ポリシーを随時更新する権利を有します。重大な変更の場合は、ユーザーに事前に通知します。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. お問い合わせ</h2>
            <p>
              本ポリシーに関するご質問やご不明な点は、アプリ内のお問い合わせフォームからご連絡ください。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-700">
          <Link href="/" className="inline-block px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition">
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
