interface TrainLoaderProps {
  title?: string
  message?: string
  fullScreen?: boolean
}

export function TrainLoader({ title = 'Carregando...', message = 'Aguarde um momento', fullScreen = true }: TrainLoaderProps) {
  const content = (
    <div className="flex flex-col items-center justify-center text-center px-6">
      <div className="relative w-28 h-28 mb-2">
        <span className="absolute left-[46%] top-0 w-6 h-6 rounded-full bg-fumaca-200 animate-vapor" />
        <span className="absolute left-[46%] top-0 w-5 h-5 rounded-full bg-fumaca-200 animate-vapor" style={{ animationDelay: '1.3s' }} />
        <span className="absolute left-[46%] top-0 w-4 h-4 rounded-full bg-fumaca-200 animate-vapor" style={{ animationDelay: '2.6s' }} />
        <img
          src="/logos/web/favicon.png"
          alt=""
          className="relative w-28 h-28 object-contain animate-chacoalhar"
        />
      </div>
      <div className="trilho w-48 mb-6" />
      <h2 className="text-2xl md:text-3xl font-display font-semibold text-ferro-800 uppercase tracking-wider mb-1">
        {title}
      </h2>
      <p className="text-base text-ferro-600">{message}</p>
    </div>
  )

  if (!fullScreen) return content

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-creme-100/95 backdrop-blur-sm">
      {content}
    </div>
  )
}
