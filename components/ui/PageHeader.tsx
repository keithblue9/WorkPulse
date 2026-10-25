export function PageHeader({ eyebrow, title, actions }: { eyebrow?: React.ReactNode; title: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="au-ph rise">
      <div className="au-col" style={{ minWidth: 0 }}>
        {eyebrow && <span className="lbl">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {actions && <div className="acts">{actions}</div>}
    </div>
  )
}
