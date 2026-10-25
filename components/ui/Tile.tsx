import { Icon } from './Icon'
type Props = { icon: string; color: string; value: React.ReactNode; label: React.ReactNode; hint?: React.ReactNode; active?: boolean; onClick?: () => void; iconInk?: string }
/** Widget-style stat tile; becomes a toggle button when onClick is given. */
export function Tile({ icon, color, value, label, hint, active, onClick, iconInk = '#fff' }: Props) {
  const body = (
    <>
      <span className="au-row au-between"><span className="ti" style={{ background: color, color: iconInk }}><Icon name={icon} size={18} stroke={2.1} /></span>{hint && <span className="lbl">{hint}</span>}</span>
      <b className="v">{value}</b>
      <span className="l">{label}</span>
    </>
  )
  return onClick
    ? <button type="button" className="au-tile rise" aria-pressed={!!active} onClick={onClick}>{body}</button>
    : <div className="au-tile rise">{body}</div>
}
