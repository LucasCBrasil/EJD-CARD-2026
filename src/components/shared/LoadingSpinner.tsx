export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
  }

  return (
    <div className="flex items-center justify-center">
      <div className={`animate-roda rounded-full border-ferro-200 border-t-vagao-600 ${sizes[size]}`} />
    </div>
  )
}
