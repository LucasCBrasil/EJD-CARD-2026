/**
 * Cenário fixo das páginas: trilhos convergindo para o horizonte e
 * a locomotiva oficial como marca d'água.
 */
export function TrilhosBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1 }} aria-hidden="true">
      <img
        src="/logos/web/trenzinho-marrom.webp"
        alt=""
        className="absolute -right-24 top-24 w-[420px] max-w-none opacity-[0.05] rotate-[-8deg]"
      />
      <svg
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1400px] max-w-none h-[38vh] min-h-[220px] opacity-[0.11]"
        viewBox="0 0 1400 400"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 14 }).map((_, i) => {
          const t = i / 13
          const y = 40 + Math.pow(t, 1.8) * 360
          const half = 18 + t * 520
          return (
            <line
              key={i}
              x1={700 - half}
              x2={700 + half}
              y1={y}
              y2={y}
              stroke="#9c6048"
              strokeWidth={2 + t * 14}
              strokeLinecap="round"
            />
          )
        })}
        <path d="M688 40 L230 400" stroke="#48240c" strokeWidth="10" fill="none" />
        <path d="M712 40 L1170 400" stroke="#48240c" strokeWidth="10" fill="none" />
      </svg>
    </div>
  )
}
