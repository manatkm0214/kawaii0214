"use client"
import MoneyAnimation from "./MoneyAnimation"

export default function Header() {
  return (
    <header className="w-full flex flex-col items-center justify-center pt-6 pb-2 mb-2 select-none">
      <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-400 drop-shadow-lg tracking-tight mb-1">
        きらきら家計簿
      </h1>
      <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
        <MoneyAnimation mascot />
      </div>
    </header>
  )
}
