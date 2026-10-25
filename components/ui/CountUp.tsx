'use client'
import { useEffect, useRef, useState } from 'react'
/** Counts from 0 to `to` once on mount (skipped when reduced motion is on). */
export function CountUp({ to, suffix = '', duration = 900 }: { to: number; suffix?: string; duration?: number }) {
  const [v, setV] = useState(to)
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !Number.isFinite(to) || to === 0) { setV(to); return }
    done.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t0 = performance.now(); let raf = 0
    const step = (n: number) => { const p = Math.min(1, (n - t0) / duration); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step) }
    setV(0); raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return <>{v}{suffix}</>
}
