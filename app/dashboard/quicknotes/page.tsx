'use client'
// [Personal] To-do — to-do pribadi + tugas yang di-assign ke / dari member lain.
// Catatan & checklist lama (QuickNote) tetap tersedia di tab "Catatan".
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Empty, Icon, PageHeader, Seg, Sheet } from '@/components/ui'
import { Avatar } from '@/components/TodoAvatar'
import {
  groupTodos, inScope, viewStatus, assigneeOf, isCreator, othersAssigned, progressRatio, dueLabel, dueBucket, fmtDate,
  jakartaToday, addDays, BUCKET_LABEL, STATUS_LABEL, type TodoLike, type TodoStatus,
} from '@/lib/todo'

const QuickNotesBoard = dynamic(() => import('@/components/QuickNotesBoard'), { ssr: false, loading: () => <div className="au-card"><div className="au-skel" /><div className="au-skel" style={{ width: '60%' }} /></div> })

type Todo = TodoLike & { _id: string }
type Member = { _id: string; name: string; email: string }
type Tab = 'mine' | 'given' | 'notes'
type Quick = 'all' | 'overdue' | 'today' | 'progress'

const lc = (s: unknown) => String(s || '').trim().toLowerCase()
const first = (s?: string) => String(s || '').split(' ')[0]

async function api(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}


function DueChip({ t, today }: { t: TodoLike; today: string }) {
  if (!t.dueDate) return null
  const b = dueBucket(t.dueDate, today)
  const tone = b === 'overdue' ? 'bad' : b === 'today' ? 'warn' : ''
  return <span className={`td-due ${tone}`}><Icon name="cal" size={12} />{dueLabel(t.dueDate, today)}{t.dueTime ? ` · ${t.dueTime}` : ''}</span>
}

/** Cincin kecil progres penerima (tugas yang saya berikan). */
function MiniRing({ done, total }: { done: number; total: number }) {
  const r = 10, c = 2 * Math.PI * r, p = total ? done / total : 0
  return (
    <span className="td-ring" aria-label={`${done} dari ${total} selesai`}>
      <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><circle cx="13" cy="13" r={r} className="bg" /><circle cx="13" cy="13" r={r} className="fg" strokeDasharray={c} strokeDashoffset={c * (1 - p)} /></svg>
      <b>{done}/{total}</b>
    </span>
  )
}

// ───────────────────────────── Baris to-do
function TodoRow({ t, me, today, onOpen, onToggle, idx }: { t: Todo; me: string; today: string; onOpen: () => void; onToggle: () => void; idx: number }) {
  const mine = assigneeOf(t, me)
  const st = viewStatus(t, me)
  const others = othersAssigned(t)
  const [d, n] = progressRatio({ ...t, assignees: others })
  const fromOther = !isCreator(t, me)
  const lastComment = [...(t.updates || [])].reverse().find(u => u.kind === 'comment' || (u.kind === 'progress' && u.text))
  const replies = (t.updates || []).filter(u => u.kind === 'comment' || (u.kind === 'progress' && u.text)).length
  return (
    <li className={`td-row${st === 'done' ? ' done' : ''}`} style={{ ['--i' as any]: Math.min(idx, 10) }}>
      {mine ? (
        <button type="button" className={`td-check s-${st}`} onClick={onToggle} aria-label={st === 'done' ? `Tandai belum selesai: ${t.title}` : `Tandai selesai: ${t.title}`} aria-pressed={st === 'done'}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
        </button>
      ) : <MiniRing done={d} total={n} />}
      <button type="button" className="td-main" onClick={onOpen}>
        <span className="td-title">{t.priority === 'high' && <i className="td-flag" aria-label="Prioritas tinggi" />}{t.title}</span>
        <span className="td-meta">
          <DueChip t={t} today={today} />
          {mine && st === 'in_progress' && <span className="td-st prog">Dikerjakan{mine.eta ? ` · target ${fmtDate(mine.eta)}` : ''}</span>}
          {fromOther && <span className="td-who"><Avatar name={t.createdByName} size={18} />dari {first(t.createdByName)}</span>}
          {!fromOther && others.length > 0 && <span className="td-who"><span className="td-avs">{others.slice(0, 3).map(a => <Avatar key={a.email} name={a.name} size={18} />)}</span>{others.length === 1 ? first(others[0].name) : `${others.length} orang`}</span>}
          {replies > 0 && <span className="td-rep" title={lastComment?.text}><Icon name="chat" size={12} />{replies}</span>}
        </span>
      </button>
    </li>
  )
}

// ───────────────────────────── Form buat / edit
function TodoEditor({ editing, members, me, myName, today, onClose, onSaved }: { editing: Todo | null; members: Member[]; me: string; myName: string; today: string; onClose: () => void; onSaved: (t: Todo) => void }) {
  const [title, setTitle] = useState(editing?.title || '')
  const [note, setNote] = useState(editing?.note || '')
  const [due, setDue] = useState(editing?.dueDate || '')
  const [time, setTime] = useState(editing?.dueTime || '')
  const [high, setHigh] = useState(editing?.priority === 'high')
  const [to, setTo] = useState<string[]>(editing ? editing.assignees.map(a => lc(a.email)).filter(e => e !== me) : [])
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false), [tried, setTried] = useState(false)
  const sent = useRef(false)
  const others = members.filter(m => lc(m.email) !== me)
  const shown = others.filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase()))
  const fri = (() => { const d = new Date(today + 'T00:00:00Z').getUTCDay(); return addDays(today, ((5 - d + 7) % 7) || 7) })()
  const quick: [string, string][] = [['Hari ini', today], ['Besok', addDays(today, 1)], ['Jumat', fri], ['Minggu depan', addDays(today, 7)]]

  async function save() {
    setTried(true)
    if (!title.trim()) { toast.error('Judul wajib diisi'); return }
    if (sent.current) return
    sent.current = true; setSaving(true)
    try {
      const body = { title: title.trim(), note, dueDate: due, dueTime: due ? time : '', priority: high ? 'high' : 'normal', assignees: to.length ? to : [me] }
      const d = editing ? await api(`/api/todos/${editing._id}`, 'PATCH', { action: 'edit', ...body }) : await api('/api/todos', 'POST', body)
      toast.success(editing ? 'Tugas diperbarui' : to.length ? `Tugas dikirim ke ${to.length === 1 ? first(members.find(m => lc(m.email) === to[0])?.name) : `${to.length} orang`}` : 'To-do ditambahkan')
      onSaved(d.data); onClose()
    } catch (e: any) { toast.error(e.message); sent.current = false } finally { setSaving(false) }
  }

  return (
    <Sheet open title={editing ? 'Edit tugas' : 'Tugas baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : editing ? 'Simpan' : to.length ? 'Kirim' : 'Tambah'}>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Apa yang perlu dikerjakan?</span>
        <input className="input td-big" autoFocus={!editing} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="Mis. Kirim draft BRD iPRO ke VP" aria-invalid={tried && !title.trim()} onKeyDown={e => { if (e.key === 'Enter') save() }} />
        {tried && !title.trim() && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>Judul wajib diisi</span>}</label>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Detail (opsional)</span>
        <textarea className="input" rows={3} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} placeholder="Konteks, link dokumen, atau hasil yang diharapkan" /></label>

      <div className="au-col" style={{ gap: 8 }}>
        <span className="lbl">Tenggat</span>
        <div className="au-chips wrap">{quick.map(([l, v]) => <button key={l} type="button" className="au-chip" aria-pressed={due === v} onClick={() => setDue(due === v ? '' : v)}>{l}</button>)}</div>
        <div className="au-grid" style={{ gridTemplateColumns: '1fr 120px', gap: 8 }}>
          <input type="date" className="input" value={due} min={editing ? undefined : today} onChange={e => setDue(e.target.value)} aria-label="Tanggal tenggat" />
          <input type="time" className="input" value={time} disabled={!due} onChange={e => setTime(e.target.value)} aria-label="Jam tenggat (opsional)" />
        </div>
        {due && <span className="au-xs au-muted">{fmtDate(due, true)} · {dueLabel(due, today).toLowerCase()}{to.length ? '. Penerima diingatkan tiap pagi sampai tugas selesai.' : ''}</span>}
      </div>

      <div className="au-col" style={{ gap: 8 }}>
        <div className="au-row au-between"><span className="lbl">Tugaskan ke</span>{to.length > 0 && <button type="button" className="au-link au-xs" onClick={() => setTo([])}>Untuk saya saja</button>}</div>
        {to.length === 0 && <span className="au-xs au-muted">Tidak memilih siapa pun = to-do pribadi untuk {first(myName)}.</span>}
        {others.length > 8 && <input className="input input-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari member" aria-label="Cari member" />}
        <div className="td-pick" role="group" aria-label="Pilih penerima">
          {shown.map(m => { const on = to.includes(lc(m.email)); return (
            <button key={m._id} type="button" className="td-pickb" aria-pressed={on} onClick={() => setTo(on ? to.filter(e => e !== lc(m.email)) : [...to, lc(m.email)])}>
              <Avatar name={m.name} size={30} /><span>{m.name}</span>
              <i className="tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12.5l4.2 4.2L19 7" /></svg></i>
            </button>) })}
        </div>
      </div>
      <label className="au-igr" style={{ border: '1px solid var(--line)', borderRadius: 16 }}><span className="k">Prioritas tinggi</span><input type="checkbox" className="au-sw" style={{ marginLeft: 'auto' }} checked={high} onChange={e => setHigh(e.target.checked)} /></label>
    </Sheet>
  )
}

// ───────────────────────────── Detail + progres + respon
function TodoDetail({ t, me, today, onClose, onChanged, onEdit, onDeleted }: { t: Todo; me: string; today: string; onClose: () => void; onChanged: (t: Todo) => void; onEdit: () => void; onDeleted: (id: string) => void }) {
  const mine = assigneeOf(t, me)
  const creator = isCreator(t, me)
  const [status, setStatus] = useState<TodoStatus>(mine?.status || 'todo')
  const [eta, setEta] = useState(mine?.eta || '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false), [confirmDel, setConfirmDel] = useState(false)
  const dirty = !!mine && (status !== mine.status || (status !== 'done' && eta !== (mine.eta || '')))
  const others = othersAssigned(t)
  const personal = others.length === 0

  async function send(kind: 'progress' | 'comment') {
    if (busy) return
    if (kind === 'comment' && !msg.trim()) return
    setBusy(true)
    try {
      const d = await api(`/api/todos/${t._id}`, 'PATCH', kind === 'progress' ? { action: 'progress', status, eta: status === 'done' ? '' : eta, text: msg } : { action: 'comment', text: msg })
      onChanged(d.data); setMsg('')
      toast.success(kind === 'progress' ? (status === 'done' ? 'Ditandai selesai' : 'Progres dikirim') : 'Respon terkirim')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function del() {
    setBusy(true)
    try { await api(`/api/todos/${t._id}`, 'DELETE'); toast.success('Tugas dihapus'); onDeleted(t._id); onClose() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const timeline = [...(t.updates || [])].filter(u => u.kind !== 'edit').reverse()
  return (
    <Sheet open title={personal ? 'To-do' : 'Tugas'} onClose={onClose}>
      <div className="td-dhead">
        <h3>{t.priority === 'high' && <i className="td-flag" aria-label="Prioritas tinggi" />}{t.title}</h3>
        <div className="au-row au-wrap" style={{ gap: 6 }}>
          <DueChip t={t} today={today} />
          {t.dueDate && <span className="au-xs au-muted">{fmtDate(t.dueDate, true)}</span>}
        </div>
        {t.note && <p className="td-note">{t.note}</p>}
      </div>

      {!personal && (
        <div className="td-people">
          <div className="td-prow"><Avatar name={t.createdByName} size={32} /><span className="au-col" style={{ gap: 1, minWidth: 0 }}><b>{t.createdByName}</b><span className="au-xs au-muted">Pemberi tugas</span></span></div>
          {others.map(a => (
            <div key={a.email} className="td-prow">
              <Avatar name={a.name} size={32} />
              <span className="au-col" style={{ gap: 1, minWidth: 0, flex: 1 }}><b>{a.name}{lc(a.email) === me ? ' (kamu)' : ''}</b><span className="au-xs au-muted">{a.status !== 'done' && a.eta ? `Target ${fmtDate(a.eta, true)}` : a.updatedAt ? `Update ${new Date(a.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : 'Belum ada update'}</span></span>
              <span className={`td-st s-${a.status}`}>{STATUS_LABEL[a.status]}</span>
            </div>
          ))}
        </div>
      )}

      {mine && (
        <div className="td-prog">
          <span className="lbl">{personal ? 'Status' : 'Progres kamu'}</span>
          <Seg full label="Status pekerjaan" value={status} onChange={setStatus} options={[['todo', 'Belum mulai'], ['in_progress', 'Dikerjakan'], ['done', 'Selesai']] as const} />
          {status !== 'done' && !personal && (
            <label className="au-col" style={{ gap: 6 }}><span className="au-xs au-muted">Selesai per kapan?</span>
              <input type="date" className="input" value={eta} min={today} onChange={e => setEta(e.target.value)} aria-label="Target selesai" /></label>
          )}
        </div>
      )}

      {!personal && (
        <div className="td-reply">
          <textarea className="input" rows={2} maxLength={1000} value={msg} onChange={e => setMsg(e.target.value)} placeholder={mine ? 'Tambahkan catatan progres atau respon…' : 'Tulis respon untuk penerima…'} aria-label="Respon" />
          <div className="au-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            {mine && dirty && <button type="button" className="btn btn-primary au-tap" disabled={busy} onClick={() => send('progress')}>Kirim update</button>}
            {(!mine || !dirty) && <button type="button" className="btn btn-primary au-tap" disabled={busy || !msg.trim()} onClick={() => send('comment')}>Kirim respon</button>}
          </div>
        </div>
      )}
      {personal && mine && dirty && <button type="button" className="btn btn-primary au-tap" disabled={busy} onClick={() => send('progress')}>Simpan status</button>}

      {!personal && timeline.length > 0 && (
        <ol className="td-tl" aria-label="Riwayat">
          {timeline.map(u => (
            <li key={u.id}>
              <Avatar name={u.byName} size={24} />
              <div className="au-col" style={{ gap: 2, minWidth: 0 }}>
                <span className="au-small"><b>{first(u.byName)}</b> {u.kind === 'created' ? 'membuat tugas ini' : u.kind === 'progress' ? <>menandai <b>{STATUS_LABEL[u.status as TodoStatus] || u.status}</b>{u.eta ? ` · target ${fmtDate(u.eta)}` : ''}</> : 'merespon'}</span>
                {u.text && <span className="td-bubble">{u.text}</span>}
                <span className="au-xs au-muted">{u.at ? new Date(u.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {creator && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}><span className="au-small" style={{ flex: 1 }}>Hapus “{t.title}”{personal ? '' : ' untuk semua penerima'}?</span><button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={del}>Ya, hapus</button></div>
        : <div className="au-row" style={{ gap: 8 }}><button type="button" className="btn au-tap" onClick={onEdit}><Icon name="edit" size={15} />Edit</button><button type="button" className="btn btn-danger au-tap" onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus</button></div>)}
    </Sheet>
  )
}

// ───────────────────────────── Halaman
export default function TodoPage() {
  const { data: session } = useSession()
  const me = lc(session?.user?.email)
  const myName = String(session?.user?.name || '')
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [tab, setTab] = useState<Tab>('mine')
  const [quick, setQuick] = useState<Quick>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ t: Todo | null } | null>(null)
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [today, setToday] = useState(() => jakartaToday())
  const adding = useRef(false)

  const load = useCallback(async () => {
    setFailed(false)
    try { const d = await api('/api/todos'); setTodos(d.data || []) } catch { setFailed(true); setTodos(t => t ?? []) }
  }, [])
  useEffect(() => {
    load()
    fetch('/api/users').then(r => (r.ok ? r.json() : { data: [] })).then(d => setMembers((d.data || []).filter((u: any) => u.active !== false && u.email))).catch(() => {})
    const p = new URLSearchParams(window.location.search)
    const id = p.get('todo'); if (id) setOpenId(id)
    const tb = p.get('tab'); if (tb === 'notes' || tb === 'given') setTab(tb)
    const iv = setInterval(() => setToday(jakartaToday()), 60_000)
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onFocus)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onFocus) }
  }, [load])

  const upsert = (t: Todo) => setTodos(list => [t, ...(list || []).filter(x => x._id !== t._id)])
  const scoped = useMemo(() => (todos || []).filter(t => tab !== 'notes' && inScope(t, me, tab)), [todos, me, tab])
  const counts = useMemo(() => {
    const open = scoped.filter(t => viewStatus(t, me) !== 'done')
    return {
      all: open.length,
      overdue: open.filter(t => dueBucket(t.dueDate, today) === 'overdue').length,
      today: open.filter(t => dueBucket(t.dueDate, today) === 'today').length,
      progress: open.filter(t => viewStatus(t, me) === 'in_progress').length,
    }
  }, [scoped, me, today])
  const filtered = scoped.filter(t => quick === 'all' || (viewStatus(t, me) !== 'done' && (quick === 'progress' ? viewStatus(t, me) === 'in_progress' : dueBucket(t.dueDate, today) === quick)))
  const groups = groupTodos(filtered, me, today)
  const mineOpen = (todos || []).filter(t => inScope(t, me, 'mine') && viewStatus(t, me) !== 'done').length
  const givenOpen = (todos || []).filter(t => inScope(t, me, 'given') && viewStatus(t, me) !== 'done').length

  async function quickAdd() {
    const title = draft.trim()
    if (!title || adding.current) return
    adding.current = true
    try { const d = await api('/api/todos', 'POST', { title, assignees: [me] }); upsert(d.data); setDraft('') }
    catch (e: any) { toast.error(e.message) } finally { adding.current = false }
  }
  async function toggle(t: Todo) {
    const mine = assigneeOf(t, me); if (!mine) return
    const next: TodoStatus = mine.status === 'done' ? 'todo' : 'done'
    const prev = todos
    setTodos(list => (list || []).map(x => x._id === t._id ? { ...x, assignees: x.assignees.map(a => lc(a.email) === me ? { ...a, status: next } : a) } : x))
    try {
      const d = await api(`/api/todos/${t._id}`, 'PATCH', { action: 'progress', status: next, eta: next === 'done' ? '' : mine.eta || '' })
      upsert(d.data)
      if (next === 'done') toast.success(isCreator(t, me) ? 'Selesai' : `Selesai — ${first(t.createdByName)} diberi tahu`)
    } catch (e: any) { setTodos(prev); toast.error(e.message) }
  }

  const open = (todos || []).find(t => t._id === openId) || null
  const loading = todos === null

  return (
    <div className="au-page">
      {editor && <TodoEditor editing={editor.t} members={members} me={me} myName={myName} today={today} onClose={() => setEditor(null)} onSaved={t => { upsert(t); if (!editor.t && othersAssigned(t).length) setTab('given') }} />}
      {open && !editor && <TodoDetail key={open._id + String(open.updatedAt)} t={open} me={me} today={today} onClose={() => { setOpenId(null); if (window.location.search.includes('todo=')) window.history.replaceState(null, '', window.location.pathname) }} onChanged={upsert} onEdit={() => setEditor({ t: open })} onDeleted={id => setTodos(l => (l || []).filter(x => x._id !== id))} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${mineOpen} to-do aktif${givenOpen ? ` · ${givenOpen} kamu berikan` : ''}`} title="[Personal] To-do" actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditor({ t: null })}><Icon name="plus" size={16} stroke={2.2} />Tugas baru</button>
        } />
        <Seg label="Tampilan" value={tab} onChange={v => { setTab(v); setQuick('all') }} options={[['mine', <span key="m">Untuk saya{mineOpen ? <em className="td-count">{mineOpen}</em> : null}</span>], ['given', <span key="g">Saya berikan{givenOpen ? <em className="td-count">{givenOpen}</em> : null}</span>], ['notes', 'Catatan']] as const} />

        {tab === 'notes' ? <QuickNotesBoard embedded /> : <>
          {tab === 'mine' && (
            <form className="td-add" onSubmit={e => { e.preventDefault(); quickAdd() }}>
              <span className="td-addic" aria-hidden="true"><Icon name="plus" size={16} stroke={2.4} /></span>
              <input value={draft} onChange={e => setDraft(e.target.value)} maxLength={200} placeholder="Tambah to-do, tekan Enter" aria-label="Tambah to-do cepat" />
              {draft.trim() && <button type="submit" className="btn btn-sm btn-primary">Tambah</button>}
            </form>
          )}
          <div className="au-chips" role="group" aria-label="Saring">
            {([['all', 'Semua aktif'], ['overdue', 'Terlambat'], ['today', 'Hari ini'], ['progress', 'Dikerjakan']] as const).map(([k, l]) => (
              <button key={k} type="button" className={`au-chip${k === 'overdue' && counts.overdue ? ' td-hot' : ''}`} aria-pressed={quick === k} onClick={() => setQuick(k)}>{l} <span style={{ opacity: .6 }}>{counts[k]}</span></button>
            ))}
          </div>
          {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>To-do gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

          {loading ? <div className="au-card">{[0, 1, 2].map(k => <div key={k} className="au-skel" style={{ width: `${80 - k * 15}%` }} />)}</div>
            : !groups.length || (groups.length === 1 && groups[0].key === 'done' && quick !== 'all') ? (
              <div className="au-card"><Empty
                title={quick !== 'all' ? 'Tidak ada di saringan ini' : tab === 'mine' ? 'Belum ada to-do' : 'Belum ada tugas yang kamu berikan'}
                text={quick !== 'all' ? 'Pilih saringan lain.' : tab === 'mine' ? 'Ketik di kolom atas untuk to-do cepat, atau buat tugas dengan tenggat.' : 'Tugaskan pekerjaan ke member lain — mereka diingatkan tiap pagi sampai selesai.'}
                action={quick !== 'all' ? <button type="button" className="btn" onClick={() => setQuick('all')}>Lihat semua</button> : <button type="button" className="btn btn-primary" onClick={() => setEditor({ t: null })}>Tugas baru</button>} /></div>
            ) : (
              <div className="td-groups">
                {groups.map(g => {
                  if (g.key === 'done' && quick !== 'all') return null
                  const collapsed = g.key === 'done' && !showDone
                  return (
                    <section key={g.key} className={`td-grp g-${g.key}`} aria-label={BUCKET_LABEL[g.key]}>
                      <header>
                        {g.key === 'done'
                          ? <button type="button" className="td-ghd" aria-expanded={!collapsed} onClick={() => setShowDone(v => !v)}><b>{BUCKET_LABEL[g.key]}</b><span>{g.items.length}</span><span className="chev" style={{ transform: `rotate(${collapsed ? -90 : 0}deg)` }}><Icon name="chev" size={16} /></span></button>
                          : <div className="td-ghd"><b>{BUCKET_LABEL[g.key]}</b><span>{g.items.length}</span></div>}
                      </header>
                      {!collapsed && <ul className="td-list">{(g.key === 'done' ? g.items.slice(0, 30) : g.items).map((t, i) => <TodoRow key={t._id} t={t} me={me} today={today} idx={i} onOpen={() => setOpenId(t._id)} onToggle={() => toggle(t)} />)}</ul>}
                    </section>
                  )
                })}
              </div>
            )}
        </>}
      </div>
    </div>
  )
}
