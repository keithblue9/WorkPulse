export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="au-empty">
      <div className="ill" aria-hidden="true" />
      <b>{title}</b>
      {text && <span style={{ maxWidth: '44ch' }}>{text}</span>}
      {action}
    </div>
  )
}
