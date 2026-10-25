/** Ringan, tanpa library chart: donut dari beberapa segmen (warna sendiri), isi tengah bebas. */
export function Donut({ data, size = 132, stroke = 18, children, label }: { data: { value: number; color: string; name?: string }[]; size?: number; stroke?: number; children?: React.ReactNode; label?: string }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, gap = total > 0 && data.filter(d => d.value > 0).length > 1 ? 2 : 0
  let acc = 0
  return (
    <div className="au-ring" role="img" aria-label={label || data.filter(d => d.value > 0).map(d => `${d.name || ''} ${d.value}`).join(', ')}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        {total > 0 && data.map((d, i) => {
          if (d.value <= 0) return null
          const len = (d.value / total) * c
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc} />
          acc += len
          return el
        })}
      </svg>
      {children && <div className="mid">{children}</div>}
    </div>
  )
}
