export type Tone = 'ok' | 'warn' | 'bad' | 'none' | 'accent'
export function Pill({ tone = 'none', children, style }: { tone?: Tone; children: React.ReactNode; style?: React.CSSProperties }) {
  return <span className={`au-pill p-${tone}`} style={style}>{children}</span>
}
