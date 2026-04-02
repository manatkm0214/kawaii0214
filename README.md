# 💰 家計簿アプリ

AI搭載のスマート家計管理アプリ（Next.js + TypeScript + Supabase + Claude AI）

---

## フォルダ構成

```
kakeibo-app/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← メインページ（全画面はここ1ファイル）
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── ai/route.ts       ← Claude AI API（カテゴリ推測・分析・節約プラン）
│   │       └── fixed-costs/route.ts  ← 固定費自動生成API
│   ├── components/
│   │   ├── BottomNav.tsx         ← ボトムナビゲーション
│   │   ├── Dashboard.tsx         ← ダッシュボード（指標・予算進捗）
│   │   ├── InputForm.tsx         ← スマート入力フォーム
│   │   ├── Charts.tsx            ← グラフ（円・折れ線・レーダー）
│   │   ├── AIAnalysis.tsx        ← AI分析・節約プラン
│   │   ├── AnnualReport.tsx      ← 年間レポート・PDF出力
│   │   └── PresetSetup.tsx       ← 初期設定（プリセット選択）
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts         ← ブラウザ用Supabaseクライアント
│       │   └── server.ts         ← サーバー用Supabaseクライアント
│       └── utils.ts              ← 型定義・定数・ユーティリティ
├── supabase_schema.sql            ← DBスキーマ（Supabaseで実行）
├── .env.local                     ← 環境変数（自分で設定）
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## セットアップ手順

### 1. プロジェクト作成

```bash
npx create-next-app@latest kakeibo-app \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*"

cd kakeibo-app
```

### 2. パッケージインストール

```bash
npm install @supabase/supabase-js @supabase/ssr recharts jspdf lucide-react
```

### 3. Supabase セットアップ

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. **SQL Editor** を開いて `supabase_schema.sql` の内容を貼り付けて実行
3. **Project Settings > API** から URL と anon key をコピー

### 4. 環境変数を設定

`.env.local` を編集：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. ファイルを配置

このREADMEと同じフォルダのファイルを、それぞれのパスに配置してください。

### 6. 起動

```bash
npm run dev
# → http://localhost:3000
```

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| 認証 | メール＋パスワード（Supabase Auth） |
| 初期設定 | プリセット選択（標準 / 貯金重視 / FIRE） |
| スマート入力 | 収入/支出/貯金/投資/固定費、円単位切替、支払方法 |
| AIカテゴリ推測 | メモからClaudeがカテゴリを自動推測 |
| ダッシュボード | 4指標・生活安全レベル・詳細指標・予算進捗 |
| グラフ | 円グラフ・折れ線・レーダーチャート |
| AI分析 | 今月の総評・注意点・来月アクション |
| AI節約プラン | 目標入力で具体的な節約プランを生成 |
| 年間レポート | 12ヶ月データ一覧・AI年間総評 |
| PDF出力 | 年間レポートをPDFでダウンロード |
| 印刷 | A4最適化レイアウト |
| 固定費自動生成 | 固定費を来月分としてワンクリックコピー |
| CSVエクスポート | 全取引データをCSVでダウンロード |
| 月切替 | ◀ 今月 ▶ で月を移動 |

---

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイル**: Tailwind CSS
- **DB/Auth**: Supabase (PostgreSQL + RLS)
- **AI**: Anthropic Claude (Haiku)
- **グラフ**: Recharts
- **PDF**: jsPDF
