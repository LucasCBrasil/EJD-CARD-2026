import React from 'react'
import { useNavigate } from '@tanstack/react-router'

interface InternalCardProps {
  icon: string
  title: string
  description: string
  path: string
  color: string
  gradient: string
  index?: number
}

const InternalCard: React.FC<InternalCardProps> = ({
  icon,
  title,
  description,
  path,
  color,
  gradient,
  index = 0
}) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate({ to: path as any })
  }

  return (
    <button
      onClick={handleClick}
      className={`group relative w-full bg-gradient-to-br ${color} ${gradient} backdrop-blur-md bg-opacity-80 border-2 rounded-3xl p-6 md:p-8 shadow-2xl hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 active:scale-95 touch-manipulation select-none opacity-0 animate-slide-in-up delay-${Math.min(index, 6) * 100} overflow-hidden`}
      type="button"
    >
      {/* Efeito de brilho no hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      
      {/* Borda interna brilhante */}
      <div className="absolute inset-0 rounded-3xl border border-white/30 pointer-events-none"></div>
      
      {/* Sparkle effect nos cantos */}
      <div className="absolute top-2 right-2 w-3 h-3 bg-golden-400 rounded-full opacity-0 group-hover:opacity-100 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-2 left-2 w-2 h-2 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-100 animate-pulse pointer-events-none" style={{ animationDelay: '0.2s' }}></div>
      
      <div className="text-center relative z-10">
        <div className="text-5xl md:text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-black font-cardinal tracking-wide mb-3 drop-shadow-lg">
          {title}
        </h3>
        <p className="text-sm md:text-base text-gray-800 font-farmhand leading-relaxed drop-shadow-md">
          {description}
        </p>
      </div>
    </button>
  )
}

export default InternalCard

