'use client'
import { useEffect, useRef, useState } from 'react'

/** Mount children only when the slot nears the viewport (keeps the first render/commit small). */
export function LazyMount({ children, minHeight = 320, eager = false }: { children: React.ReactNode; minHeight?: number; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(eager)
  useEffect(() => {
    if (on) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(true); io.disconnect() } }, { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [on])
  if (on) return <>{children}</>
  return <div ref={ref} className="au-card" aria-hidden="true" style={{ minHeight }}><div className="au-skel" style={{ width: '40%' }} /><div className="au-skel" /><div className="au-skel" style={{ width: '70%' }} /></div>
}
