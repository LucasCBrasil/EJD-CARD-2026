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
  index = 0
}) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate({ to: path as any })
  }

  return (
    <button
      onClick={handleClick}
      className={`bilhete group w-full !p-0 flex items-stretch text-left hover:-translate-y-1 hover:shadow-bilhete-hover active:scale-[0.98] transition-all duration-300 touch-manipulation select-none opacity-0 animate-slide-in-up delay-${Math.min(index, 6) * 100}`}
      type="button"
    >
      <div className={`flex items-center justify-center w-20 md:w-24 shrink-0 rounded-l-xl bg-gradient-to-br ${color}`}>
        <span className="text-4xl md:text-5xl transform group-hover:scale-110 transition-transform duration-300">
          {icon}
        </span>
      </div>
      <div className="picote-vertical flex-1 px-5 py-5 md:py-6">
        <h3 className="text-lg md:text-xl font-display font-semibold text-ferro-900 uppercase tracking-wide mb-1">
          {title}
        </h3>
        <p className="text-sm md:text-base text-ferro-700 leading-snug">
          {description}
        </p>
      </div>
      <div className="flex items-center pr-5 text-vagao-600 text-xl group-hover:translate-x-1 transition-transform duration-300">
        →
      </div>
    </button>
  )
}

export default InternalCard
