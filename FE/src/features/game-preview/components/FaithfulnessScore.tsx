export function FaithfulnessScore({ score }: { score?: number }) {
  const value = Math.round((score ?? 0) * 100)
  const color = value >= 80 ? 'bg-green-500' : value >= 65 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Faithfulness</span>
        <span className="text-muted-foreground">{value || '--'}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
