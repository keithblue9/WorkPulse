'use client'
import React, { useState, useEffect } from 'react'
import { fmtMoney, parseMoney, Cur } from '@/lib/money'

export function MoneyInput({ value, onChange, currency='IDR', className='input input-sm', style, placeholder }:{
  value:number; onChange:(n:number)=>void; currency?:Cur; className?:string; style?:React.CSSProperties; placeholder?:string }) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => { if (!focused) setText(fmtMoney(value, currency)) }, [value, currency, focused])

  function onFocus(e:React.FocusEvent<HTMLInputElement>) {
    setFocused(true)
    setText(value ? String(value) : '')
    const el = e.target; setTimeout(() => { try { el.select() } catch {} }, 0)
  }
  function onBlur() { setFocused(false); setText(fmtMoney(value, currency)) }
  function onChangeText(e:React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value)
    onChange(parseMoney(e.target.value, currency))
  }

  return <input type="text" inputMode="decimal" className={className} style={style} placeholder={placeholder}
    value={text} onChange={onChangeText} onFocus={onFocus} onBlur={onBlur} />
}
