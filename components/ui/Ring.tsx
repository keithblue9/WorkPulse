import { ringGeometry } from '@/lib/ringGeometry'
/** Progress ring; optional plan marker (dot) shows where the plan is today. */
export function Ring({ value, size = 96, stroke = 10, color = 'var(--accent)', plan, children, label }: { value: number; size?: number; stroke?: number; color?: string; plan?: number | null; children?: React.ReactNode; label?: string }) {
  const g = ringGeometry(value, size, stroke, plan)
  const h = size / 2
  return (
    <div className="au-ring" role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={h} cy={h} r={g.r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
        {value > 0 && <circle className="fg" cx={h} cy={h} r={g.r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={g.c.toFixed(1)} strokeDashoffset={g.offset.toFixed(1)} />}
        {g.planDot && <circle cx={g.planDot.x} cy={g.planDot.y} r={Math.max(4, stroke / 3)} fill="var(--hot)" stroke="var(--surface)" strokeWidth={2} />}
      </svg>
      {children && <div className="mid">{children}</div>}
    </div>
  )
}
