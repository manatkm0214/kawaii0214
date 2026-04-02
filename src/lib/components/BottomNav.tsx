"use client"

import { NavPage } from "@/lib/utils"

interface Props {
  current: NavPage
  onChange: (page: NavPage) => void
}

const NAV_ITEMS: { page: NavPage; icon: string; label: string }[] = [
  { page: "dashboard", icon: "📊", label: "ダッシュボード" },
  { page: "input", icon: "✏️", label: "入力" },
  { page: "charts", icon: "📈", label: "グラフ" },
  { page: "ai", icon: "🤖", label: "AI分析" },
  { page: "report", icon: "📄", label: "レポート" },
]

export default function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 no-print">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ page, icon, label }) => (
          <button
            key={page}
            onClick={() => onChange(page)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
              current === page
                ? "text-violet-400 bg-violet-500/10"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
