'use client'
// Popup "Tugas untukmu": muncul sekali per hari (per perangkat) untuk tugas dari member lain
// yang belum selesai dan punya tenggat — terus muncul tiap hari sampai tugas ditandai selesai.
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Portal } from '@/components/ui'
import { Avatar } from '@/components/TodoAvatar'
import { needsPopup, dueLabel, dueBucket, jakartaToday, assigneeOf, STATUS_LABEL, type TodoLike, type TodoStatus } from '@/lib/todo'

type Todo = TodoLike & { _id: string }
const lc = (s: unknown) => String(s || '').trim().toLowerCase()
const KEY = (d: string) => `wins-todo-pop-${d}`

export default function TodoPopup() {
  const { data: session } = useSession()
  const me = lc(session?.user?.email)
  const pathname = usePathname()
  const router = useRouter()
  const [items, setItems] = useState<Todo[]>([])
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const today = jakartaToday()
  const onTodoPage = pathname?.startsWith('/dashboard/quicknotes')

  useEffect(() => {
    if (!me || onTodoPage) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        let seen: string[] = []
        try { seen = JSON.parse(localStorage.getItem(KEY(today)) || '[]') } catch { /* storage diblokir: tetap tampil */ }
        const r = await fetch('/api/todos'); if (!r.ok) return
        const d = await r.json()
        const list = (d.data || []).filter((t: Todo) => needsPopup(t, me) && !seen.includes(t._id))
          .sort((a: Todo, b: Todo) => String(a.dueDate).localeCompare(String(b.dueDate)))
        if (!cancelled && list.length) { setItems(list); setShow(true) }
      } catch { /* best-effort */ }
    }, 2200)   // beri jeda setelah halaman tampil, tidak menabrak muatan awal
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, onTodoPage])

  function ack(ids: string[]) {
    try {
      const prev: string[] = JSON.parse(localStorage.getItem(KEY(today)) || '[]')
      localStorage.setItem(KEY(today), JSON.stringify(Array.from(new Set([...prev, ...ids]))))
    } catch { /* abaikan */ }
  }
  function close() { ack(items.map(t => t._id)); setShow(false) }

  async function setStatus(t: Todo, status: TodoStatus) {
    setBusy(t._id)
    try {
      const r = await fetch(`/api/todos/${t._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'progress', status, eta: assigneeOf(t, me)?.eta || '' }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Gagal menyimpan')
      toast.success(status === 'done' ? `Selesai — ${String(t.createdByName || '').split(' ')[0]} diberi tahu` : 'Ditandai sedang dikerjakan')
      const rest = items.filter(x => x._id !== t._id)
      if (status === 'done') ack([t._id])
      if (status === 'done') { setItems(rest); if (!rest.length) setShow(false) }
      else setItems(items.map(x => x._id === t._id ? { ...x, assignees: x.assignees.map(a => lc(a.email) === me ? { ...a, status } : a) } : x))
    } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }
  function openTodo(id?: string) { close(); router.push(id ? `/dashboard/quicknotes?todo=${id}` : '/dashboard/quicknotes') }

  if (!show || !items.length) return null
  const late = items.filter(t => dueBucket(t.dueDate, today) === 'overdue').length
  return (
    <Portal>
      <div className="modal-overlay td-pop-ov" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
        <div className="td-pop" role="dialog" aria-modal="true" aria-labelledby="td-pop-h">
          <div className="td-pop-hd">
            <span className="td-pop-ic" aria-hidden="true">📌</span>
            <div className="au-col" style={{ gap: 2 }}>
              <h2 id="td-pop-h">{items.length} tugas menunggu kamu</h2>
              <span className="au-small au-muted">{late ? `${late} sudah lewat tenggat. ` : ''}Update progresnya supaya pemberi tugas tahu.</span>
            </div>
          </div>
          <ul className="td-pop-list">
            {items.slice(0, 4).map((t, i) => {
              const mine = assigneeOf(t, me)
              const b = dueBucket(t.dueDate, today)
              return (
                <li key={t._id} style={{ ['--i' as any]: i }}>
                  <button type="button" className="td-pop-main" onClick={() => openTodo(t._id)}>
                    <Avatar name={t.createdByName} size={30} />
                    <span className="au-col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <b className="t">{t.title}</b>
                      <span className="au-xs au-muted">dari {String(t.createdByName || '').split(' ')[0]} · <span className={`td-due ${b === 'overdue' ? 'bad' : b === 'today' ? 'warn' : ''}`}>{dueLabel(t.dueDate, today)}</span>{mine?.status === 'in_progress' ? ` · ${STATUS_LABEL.in_progress}` : ''}</span>
                    </span>
                  </button>
                  <div className="td-pop-act">
                    {mine?.status !== 'in_progress' && <button type="button" className="btn btn-sm" disabled={busy === t._id} onClick={() => setStatus(t, 'in_progress')}>Mulai</button>}
                    <button type="button" className="btn btn-sm btn-primary" disabled={busy === t._id} onClick={() => setStatus(t, 'done')}>Selesai</button>
                  </div>
                </li>
              )
            })}
          </ul>
          {items.length > 4 && <span className="au-xs au-muted" style={{ textAlign: 'center' }}>+{items.length - 4} tugas lainnya</span>}
          <div className="td-pop-ft">
            <button type="button" className="btn au-tap" onClick={close}>Ingatkan besok</button>
            <button type="button" className="btn btn-primary au-tap" onClick={() => openTodo()}>Buka To-do</button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
