
"use client";
// Props型を先頭で定義
interface Props {
  transactions: Transaction[]
  currentMonth: string
}

import { Transaction, formatCurrency } from "@/lib/utils"
import { useMemo, useState } from "react"



const mascotsByMode = {
  normal: [
    {
      key: "girl",
      name: "さくら",
      img: "/girl-mascot.png",
      lines: [
        "1年おつかれさまっ！",
        "すごい、たくさん頑張ったね！",
        "来年も一緒にがんばろう♡",
        "私がずっと応援してるよ！",
        "きゅん…！来年も楽しみだね！",
        "着実に夢に近づいてるよ！",
        "また一歩前進だね！",
        "私も見守ってるよ！",
      ],
    },
    {
      key: "boy",
      name: "カケル",
      img: "/boy-mascot.png",
      lines: [
        "1年よく頑張ったな、偉いぞ。",
        "来年も一緒に進もうぜ。",
        "俺も応援してるからな。",
        "着実に前進してるな。",
        "困ったらいつでも頼ってくれ。",
        "今年もお疲れさま。",
        "来年も一緒に頑張ろう。",
        "その調子、かっこいいぞ！",
      ],
    },
    {
      key: "idol",
      name: "アイドル ルナ",
      img: "/idol-mascot.png",
      lines: [
        "みんなの夢、叶えてみせるよ！",
        "一緒にキラキラな1年にしよう☆",
        "がんばるあなたに、エールを送るね！",
        "ファンの応援が私の力だよ！",
        "来年も一緒に輝こう！",
        "努力は必ず報われるよ！",
        "あなたの毎日がステージだよ！",
        "笑顔でいれば、きっと大丈夫！",
      ],
    },
  ],
  kids: [
    {
      key: "kids",
      name: "まめちゃん",
      img: "/kids-mascot.png",
      lines: [
        "1年おこづかい帳がんばったね！",
        "えらい！おかし買えたかな？",
        "また来年もいっしょにがんばろう！",
        "おかねはたいせつにしようね！",
        "ちょっとずつためてえらいね！",
      ],
    },
  ],
  senior: [
    {
      key: "senior",
      name: "しげるさん",
      img: "/senior-mascot.png",
      lines: [
        "1年お疲れさまでした。",
        "健康も大事にしましょう。",
        "年金や医療費も忘れずに。",
        "無理せず、ゆっくり続けましょう。",
        "困ったら家族やサポートに相談しましょう。",
      ],
    },
  ],
}


import Image from "next/image"

export default function AnnualReport({ transactions, currentMonth }: Props) {

    // --- 追加: 子供・高齢者モード用 state/UI ---
    const [kidsInput, setKidsInput] = useState<{ income: string; expense: string }>({ income: "", expense: "" })
    function handleKidsAdd(type: "income"|"expense") {
      const val = Number(kidsInput[type])
      if (!val || val <= 0) return
      const key = `kakeibo-kids-${type}`
      const prev = Number(localStorage.getItem(key) || 0)
      localStorage.setItem(key, String(prev + val))
      setKidsInput(i => ({...i, [type]: ""}))
      window.location.reload()
    }
    function handleKidsReset() {
      localStorage.removeItem("kakeibo-kids-income")
      localStorage.removeItem("kakeibo-kids-expense")
      window.location.reload()
    }
    const [seniorInput, setSeniorInput] = useState<{medical: string, pension: string, living: string}>({medical: "", pension: "", living: ""})
    function handleSeniorAdd(type: "medical"|"pension"|"living") {
      const val = Number(seniorInput[type])
      if (!val || val <= 0) return
      const key = `kakeibo-senior-${type}`
      const prev = Number(localStorage.getItem(key) || 0)
      localStorage.setItem(key, String(prev + val))
      setSeniorInput(i => ({...i, [type]: ""}))
      window.location.reload()
    }
    function handleSeniorReset() {
      localStorage.removeItem("kakeibo-senior-medical")
      localStorage.removeItem("kakeibo-senior-pension")
      localStorage.removeItem("kakeibo-senior-living")
      window.location.reload()
    }

    // --- 既存のstate ---
    const [mode, setMode] = useState<"normal"|"kids"|"senior">("normal")
    const mascots = mascotsByMode[mode]
    const [mascot, setMascot] = useState(mascots[0].key)
    const mascotObj = mascots.find(m => m.key === mascot) || mascots[0]
    function randomLine() {
      const arr = mascotObj.lines
      return arr[Math.floor(Math.random() * arr.length)]
    }
    const [mascotLine, setMascotLine] = useState(randomLine())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aiReport, setAiReport] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [pdfLoading, setPdfLoading] = useState(false)

    // --- useMemo: 子供・高齢者サマリ ---
    const kidsSummary = useMemo(() => {
      if (mode !== "kids") return null
      const categories = ["おこづかい", "おやつ", "おもちゃ"]
      let totalIncome = 0, totalExpense = 0
      transactions.forEach((t: Transaction) => {
        if (categories.includes(t.category || "")) {
          if (t.type === "income") totalIncome += t.amount
          if (t.type === "expense") totalExpense += t.amount
        }
      })
      totalIncome += Number(localStorage.getItem("kakeibo-kids-income") || 0)
      totalExpense += Number(localStorage.getItem("kakeibo-kids-expense") || 0)
      return { totalIncome, totalExpense, balance: totalIncome - totalExpense }
    }, [mode, transactions])

    const seniorSummary = useMemo(() => {
      if (mode !== "senior") return null
      let medical = 0, pension = 0, living = 0
      transactions.forEach((t: Transaction) => {
        if ((t.category || "") === "医療費") medical += t.amount
        if ((t.category || "") === "年金") pension += t.amount
        if (["生活費", "食費", "光熱費"].includes(t.category || "")) living += t.amount
      })
      medical += Number(localStorage.getItem("kakeibo-senior-medical") || 0)
      pension += Number(localStorage.getItem("kakeibo-senior-pension") || 0)
      living += Number(localStorage.getItem("kakeibo-senior-living") || 0)
      return { medical, pension, living }
    }, [mode, transactions])
    // --- ここから下の重複state/関数/サマリは全て削除 ---


  // --- 既存のuseMemo ---
  const monthlyData = useMemo(() => {
    const now = new Date(currentMonth + "-01")
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const txs = transactions.filter(t => t.date.startsWith(m))
      const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
      const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      const saving = txs.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0)
      const investment = txs.filter(t => t.type === "investment").reduce((s, t) => s + t.amount, 0)
      const savingRate = income > 0 ? Math.round(((saving + investment) / income) * 100) : 0
      return { month: `${d.getMonth() + 1}月`, income, expense, saving, investment, savingRate }
    })
  }, [transactions, currentMonth])

  const totals = useMemo(() => ({
    income: monthlyData.reduce((s, m) => s + m.income, 0),
    expense: monthlyData.reduce((s, m) => s + m.expense, 0),
    saving: monthlyData.reduce((s, m) => s + m.saving, 0),
    investment: monthlyData.reduce((s, m) => s + m.investment, 0),
    avgSavingRate: Math.round(monthlyData.reduce((s, m) => s + m.savingRate, 0) / 12),
  }), [monthlyData])

  const autoInsights = useMemo(() => {
    const withData = monthlyData.filter(m => m.income > 0)
    if (withData.length === 0) return null
    const bestSaving = withData.reduce((a, b) => b.savingRate > a.savingRate ? b : a)
    const worstExpense = withData.reduce((a, b) => b.expense > a.expense ? b : a)
    const bestIncome = withData.reduce((a, b) => b.income > a.income ? b : a)
    const netFlow = totals.income - totals.expense - totals.saving - totals.investment
    return { bestSaving, worstExpense, bestIncome, netFlow, monthsWithData: withData.length }
  }, [monthlyData, totals])

  async function fetchAiReport() {
    setLoading(true)
    try {
      // モードごとにデータを分岐
      let data = monthlyData
      if (mode === "kids") {
        // 子供向け: おこづかい/おやつ/おもちゃカテゴリのみ
        data = monthlyData.map(m => ({
          ...m,
          income: m.income,
          expense: m.expense,
          saving: m.saving,
          investment: m.investment,
          savingRate: m.savingRate,
        }))
      } else if (mode === "senior") {
        // 高齢者: 医療費・年金・生活費カテゴリを強調（ここでは全体渡す）
        data = monthlyData
      }
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "annual", data: { monthlyData: data }, mode }),
      })
      const { result } = await res.json()
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim())
      setAiReport(parsed)
      setMascotLine(randomLine())
    } catch {
      alert("AI分析に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function downloadPDF() {
    setPdfLoading(true)
    const { default: jsPDF } = await import("jspdf")
    const doc = new jsPDF()

    // タイトル
    doc.setFontSize(20)
    doc.text("年間家計レポート", 20, 20)
    doc.setFontSize(12)
    doc.text(`期間: ${monthlyData[0].month} ～ ${monthlyData[11].month}`, 20, 32)

    // 年間合計
    doc.setFontSize(14)
    doc.text("年間サマリ", 20, 50)
    doc.setFontSize(11)
    const lines = [
      `収入合計: ${formatCurrency(totals.income)}`,
      `支出合計: ${formatCurrency(totals.expense)}`,
      `貯金合計: ${formatCurrency(totals.saving)}`,
      `投資合計: ${formatCurrency(totals.investment)}`,
      `平均貯蓄率: ${totals.avgSavingRate}%`,
    ]
    lines.forEach((l, i) => doc.text(l, 20, 62 + i * 8))

    // 月別データ表
    doc.setFontSize(14)
    doc.text("月別データ", 20, 116)
    doc.setFontSize(9)
    doc.text("月　　　収入　　　　支出　　　　貯金　　　貯蓄率", 20, 126)
    monthlyData.forEach((m, i) => {
      doc.text(
        `${m.month.padEnd(4)}  ${String(m.income).padStart(8)}  ${String(m.expense).padStart(8)}  ${String(m.saving).padStart(8)}  ${m.savingRate}%`,
        20, 134 + i * 7
      )
    })

    // AI総評
    if (aiReport) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text("AI年間総評", 20, 20)
      doc.setFontSize(11)
      const splitSummary = doc.splitTextToSize(aiReport.annual_summary, 170)
      doc.text(splitSummary, 20, 32)
      if (aiReport.next_year) {
        doc.setFontSize(12)
        doc.text("来年へのアドバイス", 20, 70)
        doc.setFontSize(10)
        aiReport.next_year.forEach((tip: string, i: number) => {
          const split = doc.splitTextToSize(`${i + 1}. ${tip}`, 170)
          doc.text(split, 20, 80 + i * 14)
        })
      }
    }

    doc.save(`家計レポート_${currentMonth}.pdf`)
    setPdfLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-2">
      {/* キャラクター選択・吹き出し */}
      <div className="col-span-1 md:col-span-2 mb-2">
        <div className="flex gap-3 items-center flex-wrap mb-2">
          <span className="text-slate-300 font-bold">モード:</span>
          {[
            { key: "normal", label: "通常" },
            { key: "kids", label: "子供" },
            { key: "senior", label: "高齢者" },
          ].map(m => (
            <button
              key={m.key}
              className={`px-3 py-1 rounded-lg font-bold text-sm border-2 ${mode === m.key ? "border-emerald-400 bg-emerald-900/30 text-emerald-200" : "border-slate-700 bg-slate-700 text-slate-300"}`}
              onClick={() => {
                setMode(m.key as "normal"|"kids"|"senior")
                const nextMascots = mascotsByMode[m.key as keyof typeof mascotsByMode]
                setMascot(nextMascots[0].key)
                setMascotLine(nextMascots[0].lines[Math.floor(Math.random() * nextMascots[0].lines.length)])
              }}
              disabled={loading}
            >{m.label}</button>
          ))}
        </div>
        <div className="flex gap-3 items-center flex-wrap mb-2">
          <span className="text-slate-300 font-bold">キャラクター:</span>
          {mascots.map(m => (
            <button
              key={m.key}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-sm border-2 shadow-lg transition-all duration-200 ${mascot === m.key ? "border-pink-400 bg-pink-900/30 text-pink-200 scale-105 ring-2 ring-pink-300" : "border-slate-700 bg-slate-700 text-slate-300 hover:scale-105 hover:ring-1 hover:ring-pink-200"}`}
              onClick={() => { setMascot(m.key); setMascotLine(m.lines[Math.floor(Math.random() * m.lines.length)]) }}
              disabled={loading}
            >
              <Image
                src={m.img}
                alt={m.name}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full border border-white bg-white"
                onError={e => {
                  (e.target as HTMLImageElement).src = "/girl-mascot.png"
                }}
              />
              {m.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 bg-slate-900/80 rounded-xl p-3 border border-pink-400/40 shadow-lg">
          <Image
            src={mascotObj.img}
            alt={mascotObj.name}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full border-2 border-pink-300 bg-white"
            onError={e => {
              (e.target as HTMLImageElement).src = "/girl-mascot.png"
            }}
          />
          <div>
            <div className="font-bold text-pink-200 text-sm mb-1">{mascotObj.name}のひとこと</div>
            <div className="text-pink-100 text-xs">{mascotLine}</div>
          </div>
        </div>
      </div>

      {/* 左カラム: サマリ + AI総評 + エクスポート */}
      <div className="flex flex-col gap-2">

        {/* 年間サマリ */}
        {mode === "kids" && kidsSummary && (
          <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-2xl p-4 mb-2">
            <h3 className="text-sm font-semibold text-yellow-300 mb-2">🧒 おこづかい帳サマリ</h3>
            <div className="flex flex-col gap-1 text-xs mb-2">
              <span>もらった合計: <span className="font-bold text-emerald-400">{formatCurrency(kidsSummary.totalIncome)}</span></span>
              <span>使った合計: <span className="font-bold text-red-400">{formatCurrency(kidsSummary.totalExpense)}</span></span>
              <span>のこり: <span className="font-bold text-blue-400">{formatCurrency(kidsSummary.balance)}</span></span>
            </div>
            {/* 簡易入力UI */}
            <div className="flex gap-2 items-end mb-1">
              <div>
                <label className="text-xs text-yellow-200">おこづかい追加</label>
                <input type="number" min="1" value={kidsInput.income} onChange={e=>setKidsInput(i=>({...i,income:e.target.value}))} className="ml-1 px-2 py-1 rounded bg-yellow-50 text-yellow-900 w-24" />
                <button onClick={()=>handleKidsAdd("income")} className="ml-1 px-2 py-1 rounded bg-emerald-500 text-white">追加</button>
              </div>
              <div>
                <label className="text-xs text-yellow-200">使った</label>
                <input type="number" min="1" value={kidsInput.expense} onChange={e=>setKidsInput(i=>({...i,expense:e.target.value}))} className="ml-1 px-2 py-1 rounded bg-yellow-50 text-yellow-900 w-24" />
                <button onClick={()=>handleKidsAdd("expense")} className="ml-1 px-2 py-1 rounded bg-red-500 text-white">記録</button>
              </div>
              <button onClick={handleKidsReset} className="ml-2 px-2 py-1 rounded bg-yellow-500 text-white text-xs">リセット</button>
            </div>
            <div className="text-xs text-yellow-100 mt-1">※簡易入力はページ再読込で反映・リセットボタンで初期化できます</div>
            <div className="text-xs text-yellow-200 mt-1">おこづかい帳は「もらった」「つかった」を記録して、のこりを確認できるよ！<br/>おかねはたいせつに、すこしずつためてみよう！</div>
          </div>
        )}
        {mode === "senior" && seniorSummary && (
          <div className="bg-blue-900/30 border border-blue-600/40 rounded-2xl p-4 mb-2">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">👴 高齢者向けサマリ</h3>
            <div className="flex flex-col gap-1 text-xs mb-2">
              <span>医療費合計: <span className="font-bold text-pink-400">{formatCurrency(seniorSummary.medical)}</span></span>
              <span>年金収入合計: <span className="font-bold text-emerald-400">{formatCurrency(seniorSummary.pension)}</span></span>
              <span>生活費合計: <span className="font-bold text-blue-400">{formatCurrency(seniorSummary.living)}</span></span>
            </div>
            {/* 簡易入力UI */}
            <div className="flex gap-2 items-end mb-1">
              <div>
                <label className="text-xs text-blue-200">医療費</label>
                <input type="number" min="1" value={seniorInput.medical} onChange={e=>setSeniorInput(i=>({...i,medical:e.target.value}))} className="ml-1 px-2 py-1 rounded bg-blue-50 text-blue-900 w-24" />
                <button onClick={()=>handleSeniorAdd("medical")} className="ml-1 px-2 py-1 rounded bg-pink-500 text-white">追加</button>
              </div>
              <div>
                <label className="text-xs text-blue-200">年金</label>
                <input type="number" min="1" value={seniorInput.pension} onChange={e=>setSeniorInput(i=>({...i,pension:e.target.value}))} className="ml-1 px-2 py-1 rounded bg-blue-50 text-blue-900 w-24" />
                <button onClick={()=>handleSeniorAdd("pension")} className="ml-1 px-2 py-1 rounded bg-emerald-500 text-white">追加</button>
              </div>
              <div>
                <label className="text-xs text-blue-200">生活費</label>
                <input type="number" min="1" value={seniorInput.living} onChange={e=>setSeniorInput(i=>({...i,living:e.target.value}))} className="ml-1 px-2 py-1 rounded bg-blue-50 text-blue-900 w-24" />
                <button onClick={()=>handleSeniorAdd("living")} className="ml-1 px-2 py-1 rounded bg-blue-500 text-white">追加</button>
              </div>
              <button onClick={handleSeniorReset} className="ml-2 px-2 py-1 rounded bg-blue-500 text-white text-xs">リセット</button>
            </div>
            <div className="text-xs text-blue-100 mt-1">※簡易入力はページ再読込で反映・リセットボタンで初期化できます</div>
            <div className="text-xs text-blue-200 mt-1">医療費・年金・生活費を記録して、毎月の支出や収入を見える化できます。<br/>健康や生活の安心のために、定期的に記録しましょう。</div>
          </div>
        )}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 年間サマリ</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "収入合計", value: totals.income, color: "text-emerald-400" },
              { label: "支出合計", value: totals.expense, color: "text-red-400" },
              { label: "貯金合計", value: totals.saving, color: "text-blue-400" },
              { label: "投資合計", value: totals.investment, color: "text-violet-400" },
            ].map(item => (
              <div key={item.label} className="bg-slate-900/50 rounded-xl p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`font-bold text-sm ${item.color}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-slate-900/50 rounded-xl p-3 flex justify-between">
            <span className="text-xs text-slate-400">年間平均貯蓄率</span>
            <span className="font-bold text-violet-400">{totals.avgSavingRate}%</span>
          </div>
        </div>

        {/* AI年間総評 */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">🤖 AI年間総評</h3>
            <button
              onClick={fetchAiReport}
              disabled={loading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-xs transition-all"
            >
              {loading ? "分析中..." : "AI分析"}
            </button>
          </div>
          {aiReport ? (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs text-slate-300 leading-relaxed">{aiReport.annual_summary}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2">
                  <p className="text-xs text-emerald-400 font-semibold mb-1">最良の月</p>
                  <p className="text-xs text-slate-400">{aiReport.best_month}</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2">
                  <p className="text-xs text-red-400 font-semibold mb-1">要改善の月</p>
                  <p className="text-xs text-slate-400">{aiReport.worst_month}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-blue-400 font-semibold mb-1">来年へのアドバイス</p>
                {Array.isArray(aiReport.next_year)
                  ? aiReport.next_year.map((a: string, i: number) => (
                      <p key={i} className="text-xs text-slate-400 ml-2">{i + 1}. {a}</p>
                    ))
                  : <p className="text-xs text-slate-400 ml-2">{aiReport.next_year}</p>
                }
              </div>
            </div>
          ) : autoInsights ? (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs text-slate-500 mb-2">データから自動集計したハイライトです。AIボタンで詳細な総評を取得できます。</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2">
                  <p className="text-xs text-emerald-400 font-semibold mb-1">貯蓄率 最高月</p>
                  <p className="text-xs text-slate-300">{autoInsights.bestSaving.month}</p>
                  <p className="text-xs text-emerald-400">{autoInsights.bestSaving.savingRate}%</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2">
                  <p className="text-xs text-red-400 font-semibold mb-1">支出 最大月</p>
                  <p className="text-xs text-slate-300">{autoInsights.worstExpense.month}</p>
                  <p className="text-xs text-red-400">{formatCurrency(autoInsights.worstExpense.expense)}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-2">
                  <p className="text-xs text-blue-400 font-semibold mb-1">収入 最大月</p>
                  <p className="text-xs text-slate-300">{autoInsights.bestIncome.month}</p>
                  <p className="text-xs text-blue-400">{formatCurrency(autoInsights.bestIncome.income)}</p>
                </div>
                <div className={`rounded-lg p-2 border ${autoInsights.netFlow >= 0 ? "bg-violet-900/20 border-violet-700/30" : "bg-orange-900/20 border-orange-700/30"}`}>
                  <p className={`text-xs font-semibold mb-1 ${autoInsights.netFlow >= 0 ? "text-violet-400" : "text-orange-400"}`}>未配分残高</p>
                  <p className="text-xs text-slate-300">{formatCurrency(Math.abs(autoInsights.netFlow))}</p>
                  <p className={`text-xs ${autoInsights.netFlow >= 0 ? "text-violet-400" : "text-orange-400"}`}>{autoInsights.netFlow >= 0 ? "余剰" : "超過"}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 text-right">集計対象: {autoInsights.monthsWithData}ヶ月</p>
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-4">データがありません</p>
          )}
        </div>

        {/* エクスポートボタン */}
        <div className="flex gap-2">
          <button
            onClick={downloadPDF}
            disabled={pdfLoading}
            className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl text-sm font-medium transition-all"
          >
            {pdfLoading ? "生成中..." : "📄 PDFダウンロード"}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-all no-print"
          >
            🖨️ 印刷
          </button>
        </div>

      </div>{/* /左カラム */}

      {/* 右カラム: 月別テーブル + 貯蓄率チャート */}
      <div className="flex flex-col gap-2">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 overflow-x-auto print-page">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">月別データ</h3>
          <table className="w-full text-xs text-slate-400">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="py-1 text-left">月</th>
                <th className="py-1 text-right">収入</th>
                <th className="py-1 text-right">支出</th>
                <th className="py-1 text-right">貯金</th>
                <th className="py-1 text-right">投資</th>
                <th className="py-1 text-right">貯蓄率</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={m.month} className="border-b border-slate-800/50">
                  <td className="py-1">{m.month}</td>
                  <td className="py-1 text-right text-emerald-400">{m.income > 0 ? formatCurrency(m.income) : "-"}</td>
                  <td className="py-1 text-right text-red-400">{m.expense > 0 ? formatCurrency(m.expense) : "-"}</td>
                  <td className="py-1 text-right text-blue-400">{m.saving > 0 ? formatCurrency(m.saving) : "-"}</td>
                  <td className="py-1 text-right text-violet-400">{m.investment > 0 ? formatCurrency(m.investment) : "-"}</td>
                  <td className="py-1 text-right">{m.savingRate > 0 ? `${m.savingRate}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 貯蓄率バーチャート */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📈 月別貯蓄率</h3>
          <div className="space-y-1">
            {monthlyData.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-6 shrink-0">{m.month.replace("月", "")}</span>
                <div className="flex-1 bg-slate-900/60 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m.savingRate >= 20 ? "bg-emerald-500" : m.savingRate >= 10 ? "bg-blue-500" : m.savingRate > 0 ? "bg-amber-500" : "bg-slate-700"}`}
                    style={{ width: `${Math.min(m.savingRate, 100)}%` }}
                  />
                </div>
                <span className={`text-xs w-8 text-right ${m.savingRate >= 20 ? "text-emerald-400" : m.savingRate >= 10 ? "text-blue-400" : m.savingRate > 0 ? "text-amber-400" : "text-slate-600"}`}>
                  {m.savingRate > 0 ? `${m.savingRate}%` : "-"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-3 pt-2 border-t border-slate-700/50">
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>20%以上</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>10-19%</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>1-9%</span>
          </div>
        </div>
      </div>{/* /右カラム */}

    </div>
  )
}
