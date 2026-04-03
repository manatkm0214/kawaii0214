import React from "react"

// シンプルなコインが舞うアニメーション
export default function MoneyAnimation({ mascot = false, type = "coin" }: { mascot?: boolean, type?: "coin" | "girl" | "boy" }) {
  // コインの大きさを安定してランダム化（初回のみ生成、フックは必ず先頭で呼ぶ）
  const coinFontSizes = React.useMemo(() =>
    Array.from({ length: 8 }, (_, i) => 24 + Math.floor(((Math.sin(i + 1) + 1) * 0.5) * 16)),
    []
  )
  if (mascot) {
    // 右下固定のキャラ（コインくん/女の子/イケメン）＋きらめき
    let mascotEmoji = "🪙";
    let mascotLabel = "コインくん";
    let accent = "#ffe066";
    let deco = ["✨", "🌟", "🪙"];
    if (type === "girl") {
      mascotEmoji = "👧";
      mascotLabel = "かわいい女の子";
      accent = "#ffb6e6";
      deco = ["✨", "💖", "🌸"];
    } else if (type === "boy") {
      mascotEmoji = "🧑‍💼";
      mascotLabel = "イケメン";
      accent = "#8ecaff";
      deco = ["✨", "💎", "🌟"];
    }
    return (
      <div style={{position: "fixed", bottom: 24, right: 24, zIndex: 50, pointerEvents: "none"}}>
        <div className="relative select-none" style={{width: 64, height: 64}}>
          {/* キャラ本体 */}
          <div className="animate-bounce-slow absolute left-1/2 top-1/2" style={{fontSize: 48, filter: `drop-shadow(0 2px 8px ${accent}99)`, transform: "translate(-50%, -50%)"}}>
            <span role="img" aria-label={mascotLabel}>{mascotEmoji}</span>
          </div>
          {/* きらめき・デコ */}
          {[...Array(3)].map((_, i) => (
            <span
              key={"star"+i}
              className={`absolute mascot-star mascot-star-${i}`}
              style={{
                left: [8, 44, 32][i],
                top: [8, 12, 44][i],
                fontSize: [18, 14, 12][i],
                color: accent,
                opacity: 0.85 - i * 0.2,
                filter: "drop-shadow(0 1px 2px #0003)",
                animationDelay: `${i * 0.7}s`,
              }}
            >
              {deco[i]}
            </span>
          ))}
        </div>

      </div>
    )
  }
  // 通常のコインアニメーション
  return (
    <div className="relative w-full h-16 overflow-visible pointer-events-none select-none">
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className={`absolute animate-coin-float left-[${12*i}%] top-0`}
          style={{
            animationDelay: `${i * 0.3}s`,
            fontSize: `${coinFontSizes[i]}px`,
            color: ["#FFD700", "#FFF8DC", "#F9D923"][i%3],
            filter: "drop-shadow(0 2px 4px #0002)",
          }}
        >
          💰
        </span>
      ))}

    </div>
  )
}
