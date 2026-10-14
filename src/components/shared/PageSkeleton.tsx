export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-ferro-100 rounded w-1/4"></div>
      <div className="h-4 bg-ferro-100 rounded w-1/2"></div>
      <div className="space-y-3">
        <div className="h-20 bg-ferro-100 rounded-xl"></div>
        <div className="h-20 bg-ferro-100 rounded-xl"></div>
        <div className="h-20 bg-ferro-100 rounded-xl"></div>
      </div>
    </div>
  )
}
