import { describe, it, expect } from 'vitest'
import { INLINE_MARK, decodeDataUrl, isDataUrl, noteImageUrl, notesListPipeline, restoreImages, withImageRefs } from '@/lib/notesImages'

const ID = '507f1f77bcf86cd799439011'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
const BLOB = 'https://abc.public.blob.vercel-storage.com/notes/x-AbC123.png'

describe('noteImageUrl / withImageRefs', () => {
  it('membuat alamat dengan versi dari updatedAt', () => {
    expect(noteImageUrl(ID, 2, '2026-11-25T00:00:00.000Z')).toBe(`/api/notes/${ID}/image/2?v=${Date.parse('2026-11-25T00:00:00.000Z')}`)
    expect(noteImageUrl(ID, 0)).toBe(`/api/notes/${ID}/image/0`)
    expect(noteImageUrl(ID, 0, 'bukan-tanggal')).toBe(`/api/notes/${ID}/image/0`)
  })
  it('mengganti hanya penanda inline; URL Blob tetap', () => {
    const out = withImageRefs({ _id: ID, updatedAt: '2026-11-25T00:00:00.000Z', images: [INLINE_MARK, BLOB, INLINE_MARK], title: 't' })
    expect(out.images[0]).toMatch(new RegExp(`^/api/notes/${ID}/image/0\\?v=\\d+$`))
    expect(out.images[1]).toBe(BLOB)
    expect(out.images[2]).toMatch(new RegExp(`^/api/notes/${ID}/image/2\\?v=\\d+$`))
    expect((out as { title?: string }).title).toBe('t')
  })
  it('aman untuk catatan tanpa gambar', () => {
    expect(withImageRefs({ _id: ID }).images).toEqual([])
    expect(withImageRefs({ _id: ID, images: null as unknown }).images).toEqual([])
  })
})

describe('restoreImages — simpan hasil edit tidak boleh menghilangkan gambar', () => {
  const stored = [PNG, BLOB, JPG]
  const listed = withImageRefs({ _id: ID, updatedAt: 1, images: [INLINE_MARK, BLOB, INLINE_MARK] }).images as string[]

  it('menyimpan tanpa mengubah gambar → isi asli kembali utuh', () => {
    expect(restoreImages(listed, ID, stored)).toEqual(stored)
  })
  it('menghapus satu gambar → hanya gambar itu yang hilang, sisanya asli', () => {
    expect(restoreImages([listed[0], listed[2]], ID, stored)).toEqual([PNG, JPG])
  })
  it('menambah gambar baru (data URL atau Blob) → dipakai apa adanya', () => {
    const NEW = 'data:image/png;base64,AAAA'
    expect(restoreImages([...listed, NEW, 'https://x/y.png'], ID, stored)).toEqual([...stored, NEW, 'https://x/y.png'])
  })
  it('membuang rujukan ke catatan lain / indeks yang tidak ada / bukan string', () => {
    const other = '/api/notes/aaaaaaaaaaaaaaaaaaaaaaaa/image/0?v=1'
    expect(restoreImages([other, `/api/notes/${ID}/image/9`, 42, null, listed[0]], ID, stored)).toEqual([PNG])
  })
  it('input bukan array → kosong', () => {
    expect(restoreImages(undefined, ID, stored)).toEqual([])
    expect(restoreImages('x', ID, stored)).toEqual([])
  })
})

describe('decodeDataUrl', () => {
  it('mengurai gambar raster', () => {
    const r = decodeDataUrl(PNG)!
    expect(r.mime).toBe('image/png')
    expect(r.bytes.length).toBeGreaterThan(0)
    expect(decodeDataUrl('data:image/jpg;base64,/9j/4AAQ')!.mime).toBe('image/jpeg')
  })
  it('menolak SVG, bukan gambar, dan data rusak', () => {
    expect(decodeDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeNull()
    expect(decodeDataUrl('data:text/html;base64,PGgxPg==')).toBeNull()
    expect(decodeDataUrl('data:image/png;base64,')).toBeNull()
    expect(decodeDataUrl('https://x/y.png')).toBeNull()
    expect(decodeDataUrl(undefined)).toBeNull()
  })
  it('isDataUrl', () => { expect(isDataUrl(PNG)).toBe(true); expect(isDataUrl(BLOB)).toBe(false) })
})

describe('notesListPipeline', () => {
  it('mode penuh: urut terbaru, tanpa $match/$limit', () => {
    const p = notesListPipeline(false)
    expect(p.some(s => '$match' in s)).toBe(false)
    expect(p.some(s => '$limit' in s)).toBe(false)
    expect(p[0]).toEqual({ $sort: { date: -1, createdAt: -1 } })
  })
  it('mode pinned: hanya yang disematkan, maksimal 5, diurutkan sebelum dibatasi', () => {
    const p = notesListPipeline(true)
    expect(p[0]).toEqual({ $match: { pinned: true } })
    expect(p.findIndex(s => '$sort' in s)).toBeLessThan(p.findIndex(s => '$limit' in s))
    expect(p.find(s => '$limit' in s)).toEqual({ $limit: 5 })
  })
  it('selalu mengganti data URL di sisi database', () => {
    expect(JSON.stringify(notesListPipeline(false))).toContain(INLINE_MARK)
  })
})
