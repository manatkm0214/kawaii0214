"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  onComplete: () => void
}

export default function PresetSetup({ onComplete }: Props) {
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleCreateProfile() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        alert("ユーザー情報を取得できませんでした")
        return
      }

      const { error } = await supabase.from("profiles").insert({
        id: authData.user.id,
        display_name: displayName.trim() || null,
        currency: "JPY",
      })

      if (error) {
        alert("プロフィール作成に失敗しました: " + error.message)
        return
      }

      onComplete()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">はじめに設定</h2>
        <p className="text-sm text-slate-400">表示名を登録すると利用を開始できます。</p>

        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="表示名（任意）"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500"
        />

        <button
          onClick={handleCreateProfile}
          disabled={loading}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold"
        >
          {loading ? "作成中..." : "開始する"}
        </button>
      </div>
    </div>
  )
}
