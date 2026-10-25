'use client'
/** iOS-style segmented control. */
export function Seg<T extends string | number>({ options, value, onChange, label, full }: { options: ReadonlyArray<T | readonly [T, React.ReactNode]>; value: T; onChange: (v: T) => void; label: string; full?: boolean }) {
  return (
    <div className={`au-seg${full ? ' au-segf' : ''}`} role="group" aria-label={label}>
      {options.map(o => {
        const [v, l] = Array.isArray(o) ? (o as readonly [T, React.ReactNode]) : [o as T, String(o)]
        return <button type="button" key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>
      })}
    </div>
  )
}
