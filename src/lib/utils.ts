export type TransactionType = "income" | "expense" | "saving" | "investment"

export type TabType = TransactionType | "fixed"

export type NavPage = "dashboard" | "input" | "charts" | "ai" | "report"

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  category: string
  memo: string
  payment_method: string
  is_fixed: boolean
  date: string
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: string
  amount: number
  month: string
  created_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  currency: string
  created_at: string
}

export const PAYMENT_METHODS = ["カード", "現金", "口座振替", "QR決済", "その他"] as const

export const CATEGORIES: Record<TransactionType, string[]> = {
  income: ["給料", "副業", "賞与", "臨時収入", "その他"],
  expense: ["食費", "住居", "水道光熱", "通信", "交通", "医療", "日用品", "娯楽", "教育", "その他"],
  saving: ["先取り貯金", "積立", "緊急資金", "その他"],
  investment: ["つみたてNISA", "iDeCo", "投信", "株式", "その他"],
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value)
}