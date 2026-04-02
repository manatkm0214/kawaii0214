import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 今月の固定費を取得
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const { data: fixedTxns } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_fixed", true)
    .like("date", `${thisMonth}%`)

  if (!fixedTxns?.length) {
    return NextResponse.json({ message: "固定費が見つかりません", count: 0 })
  }

  // 来月の日付を計算
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`

  // 既に来月のコピーがないか確認
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .like("date", `${nextMonthStr}%`)
    .eq("is_fixed", true)

  if (existing?.length) {
    return NextResponse.json({ message: "来月分は既に生成済みです", count: 0 })
  }

  // 来月分としてコピー
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const copies = fixedTxns.map(({ created_at, ...rest }) => ({
    ...rest,
    date: `${nextMonthStr}-01`,
  }))

const { error } = await supabase.from("transactions").insert(copies)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: `${copies.length}件の固定費を来月分として生成しました`, count: copies.length })
}