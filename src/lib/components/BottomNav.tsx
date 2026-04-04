"use client"

import { NavPage } from "@/lib/utils"

interface Props {
  current: NavPage
  onChange: (page: NavPage) => void
}

const NAV_ITEMS: { page: NavPage; icon: string; label: string }[] = [
  { page: "dashboard", icon: "📊", label: "ホーム" },
  { page: "input", icon: "✏️", label: "入力" },
  { page: "calendar", icon: "📅", label: "カレンダー" },
  { page: "charts", icon: "📈", label: "グラフ" },
  { page: "ai", icon: "🤖", label: "AI" },
  { page: "report", icon: "📄", label: "レポート" },
  { page: "goals", icon: "🎯", label: "目標" },
]

export default function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 no-print">
      <div className="flex overflow-x-auto items-center h-14 px-1" style={{ scrollbarWidth: "none" }}>
        {NAV_ITEMS.map(({ page, icon, label }) => (
          <button
            key={page}
            onClick={() => onChange(page)}
            className={`flex-none flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-14 ${
              current === page
                ? "text-violet-400 bg-violet-500/10"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
