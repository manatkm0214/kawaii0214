"use client"

import { Transaction } from "@/lib/utils"
// Claude用AIProvider型のimport削除
import Charts from "./Charts"


import { useState } from "react"


type Provider = "openai" | "gemini"

export default function AIAnalysis({ transactions, currentMonth }: { transactions: Transaction[]; currentMonth: string }) {
  const [provider, setProvider] = useState<Provider>("openai")
  const [analysisType, setAnalysisType] = useState<"analysis" | "saving" | "advice">("analysis")
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")


  async function handleAnalysis() {
    setLoading(true)
    setError("")
    setResult("")
    try {
      let data = transactions
      // analysis: 直近3ヶ月, saving/advice: 今月のみ
      if (analysisType === "analysis") {
        const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse().slice(0, 3)
        data = transactions.filter(t => months.includes(t.date.slice(0, 7)))
      } else {
        data = transactions.filter(t => t.date.slice(0, 7) === currentMonth)
      }
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          type: analysisType,
          data,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "AI分析に失敗しました")
      setResult(payload?.result || "")
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError("AI分析に失敗しました")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* 年間グラフ（12ヶ月分） */}
      <Charts transactions={transactions} currentMonth={currentMonth} />

      <div className="mt-6 p-4 bg-slate-800 rounded-xl border border-slate-700 flex flex-col gap-4">
        <div className="flex gap-3 items-center flex-wrap">
          <span className="text-slate-300 font-bold">AIプロバイダー:</span>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-sm ${provider === "openai" ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-300"}`}
            onClick={() => setProvider("openai")}
            disabled={loading}
          >OpenAI</button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-sm ${provider === "gemini" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"}`}
            onClick={() => setProvider("gemini")}
            disabled={loading}
          >Gemini</button>
        </div>
        <div className="flex gap-3 items-center flex-wrap mt-2">
          <span className="text-slate-300 font-bold">分析種別:</span>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-sm ${analysisType === "analysis" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`}
            onClick={() => setAnalysisType("analysis")}
            disabled={loading}
          >今月のAI分析</button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-sm ${analysisType === "saving" ? "bg-cyan-600 text-white" : "bg-slate-700 text-slate-300"}`}
            onClick={() => setAnalysisType("saving")}
            disabled={loading}
          >AI節約プラン</button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-sm ${analysisType === "advice" ? "bg-pink-600 text-white" : "bg-slate-700 text-slate-300"}`}
            onClick={() => setAnalysisType("advice")}
            disabled={loading}
          >AI生活アドバイス</button>
        </div>
        <button
          className="mt-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-60"
          onClick={handleAnalysis}
          disabled={loading}
        >{loading ? (analysisType === "analysis" ? "分析中..." : analysisType === "saving" ? "節約案作成中..." : "アドバイス生成中...") : (
          analysisType === "analysis" ? "今月のAI分析" : analysisType === "saving" ? "AI節約プラン" : "AI生活アドバイス"
        )}</button>
        {error && <div className="text-red-400 font-bold">{error}</div>}
        {result && (
          <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700 whitespace-pre-wrap text-slate-100">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
