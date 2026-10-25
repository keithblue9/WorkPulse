'use client'
import { create } from 'zustand'
import { yearsRange, clampYear } from '@/lib/yearRange'

// Global year for every menu (multi-year). Saved per browser; pages read it with useYear().
const KEY = 'wins-year'
const NOW = new Date().getFullYear()
export const FIRST_DATA_YEAR = 2025
const YEARS = yearsRange([FIRST_DATA_YEAR], NOW)

type YearState = { year: number; years: number[]; setYear: (y: number) => void; hydrate: () => void }
export const useYear = create<YearState>((set) => ({
  year: NOW,
  years: YEARS,
  setYear: (y) => { set({ year: y }); try { localStorage.setItem(KEY, String(y)) } catch {} },
  hydrate: () => { let saved: string | null = null; try { saved = localStorage.getItem(KEY) } catch {} set({ year: clampYear(saved, YEARS, NOW) }) },
}))
