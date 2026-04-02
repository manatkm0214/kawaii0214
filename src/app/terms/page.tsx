'use client'

import Link from 'next/link'

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">利用規約</h1>
        <p className="text-gray-500 mb-8">最終更新: 2026年4月2日</p>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. はじめに</h2>
            <p>
              本利用規約（以下「本規約」）は、ユーザーが本アプリケーション（以下「当アプリ」）を利用する際に適用される条件を定めています。当アプリの利用により、ユーザーは本規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. サービスの説明</h2>
            <p>
              当アプリは、以下のサービスを提供する家計管理アプリケーションです：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>家計収支の記録および管理</li>
              <li>予算設定および追跡</li>
              <li>AI による財務分析およびアドバイス</li>
              <li>月間・年間レポート生成</li>
              <li>複数の認証方法でのアカウント管理</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. ユーザーの責任</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>アカウント情報（メールアドレス、パスワードなど）の正確性と安全性を保つ責任</li>
              <li>アカウントから発生するすべての活動に対する責任</li>
              <li>不正アクセスを発見した場合の速やかな報告義務</li>
              <li>本規約および適用法の遵守</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 禁止事項</h2>
            <p>ユーザーは以下の行為を禁止します：</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>当アプリまたは他のシステムへの不正アクセス</li>
              <li>当アプリの機能を妨害または中断させる行為</li>
              <li>他のユーザーの情報を無断で使用する行為</li>
              <li>当アプリを使用した違法行為または有害な行為</li>
              <li>マルウェア、ウイルス、スパムの配布</li>
              <li>当アプリのリバースエンジニアリングまたは逆コンパイル</li>
              <li>当アプリの内容の無断転用または複製</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. 知的財産権</h2>
            <p>
              当アプリのすべてのコンテンツ、デザイン、ロゴ、およびソフトウェアは、開発者またはその他の適切な所有者の知的財産です。ユーザーは当アプリの私的、非営利的な使用のためのみこれらを使用できます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. AI分析機能の免責事項</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>AI分析は参考情報であり、確実な財務アドバイスではありません</li>
              <li>ユーザーは重大な財務決定の前に専門家の意見を求めるべきです</li>
              <li>AI分析に基づく損失に対して当アプリは一切の責任を負いません</li>
              <li>AI の生成内容の正確性を保証しません</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. サービスの変更および停止</h2>
            <p>
              当アプリは以下の権利を有します：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>ユーザーへの事前通知の有無にかかわらずサービスを変更する権利</li>
              <li>メンテナンスのためサービスを一時停止する権利</li>
              <li>本規約違反の場合、アカウントを停止または削除する権利</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. 免責事項</h2>
            <p>当アプリは以下の点について一切の責任を負いません：</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>データの損失または破損</li>
              <li>サービスの中断または遅延</li>
              <li>第三者のサービス（OAuth認証、AI分析）の障害</li>
              <li>ユーザーが当アプリを使用した結果生じたいかなる損害</li>
              <li>当アプリの利用で得られる結果または出力</li>
            </ul>
            <p className="mt-4 font-semibold">
              当アプリは「現状のまま」提供されます。明示または黙示を問わず、いかなる保証も提供されません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. 責任の制限</h2>
            <p>
              いかなる場合においても、当アプリはユーザーまたは第三者に対して、当アプリの使用またはアクセス不能から生じるいかなる直接的、間接的、付随的、特別な、またはその他の損害および損失についても責任を取りません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. アカウント削除</h2>
            <p>
              ユーザーはいつでもアカウントを削除する権利があります。アカウント削除後、すべてのデータは当アプリから削除されます。削除されたデータの復旧はできません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. 外部リンク</h2>
            <p>
              当アプリが外部ウェブサイトへのリンクを含む場合、当アプリはこれらのサイトの内容に対して責任を負いません。外部サイトの利用は各サイトの利用規約に従うものとします。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. 規約の変更</h2>
            <p>
              当アプリは本規約を随時更新する権利を有します。変更は当アプリに投稿された時点で有効となります。継続的な使用は新しい規約への同意を意味します。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. 分離可能性</h2>
            <p>
              本規約の一部が無効または執行不可能と見なされた場合、その部分は削除され、残りの条項は全文有効のままとなります。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. 準拠法</h2>
            <p>
              本規約は日本法に準拠し、日本の法律に従って解釈されるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. お問い合わせ</h2>
            <p>
              本規約に関するご質問またはご不明な点は、アプリ内のお問い合わせフォームからご連絡ください。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/" className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
